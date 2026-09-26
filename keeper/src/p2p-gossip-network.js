'use strict';

const { createLogger } = require('./logger');
const crypto = require('crypto');

const DEFAULT_CONFIG = {
  listenAddr: '/ip4/0.0.0.0/tcp/4001',
  bootstrapPeers: [],
  gossipTopic: 'sorotask/keeper/assignments',
  heartbeatIntervalMs: 10000,
  maxPeers: 50,
  epochDurationMs: 60000,
  vrfSeed: process.env.KEEPER_VRF_SEED || crypto.randomBytes(32).toString('hex'),
};

class VRFResolver {
  constructor(seed) {
    this.seed = seed;
  }

  getDeterministicPriority(taskId, epoch, peerId) {
    const input = `${this.seed}:${taskId}:${epoch}:${peerId}`;
    const hash = crypto.createHash('sha256').update(input).digest();
    return hash.readUInt32BE(0);
  }

  getEpochSeed(epoch) {
    return crypto.createHash('sha256').update(`${this.seed}:${epoch}`).digest('hex');
  }
}

class GossipSubNetwork {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = createLogger('p2p-gossip-network');
    this.peers = new Map();
    this.taskClaims = new Map();
    this.vrf = new VRFResolver(this.config.vrfSeed);
    this.currentEpoch = Math.floor(Date.now() / this.config.epochDurationMs);
    this.peerId = crypto.randomBytes(20).toString('hex');
    this.isRunning = false;
  }

  async start() {
    this.isRunning = true;
    this.logger.info('Starting P2P GossipSub network', {
      peerId: this.peerId,
      listenAddr: this.config.listenAddr,
    });

    this.heartbeatTimer = setInterval(() => {
      this.heartbeat();
    }, this.config.heartbeatIntervalMs);

    this.epochTimer = setInterval(() => {
      this.advanceEpoch();
    }, this.config.epochDurationMs);
  }

  async stop() {
    this.isRunning = false;
    clearInterval(this.heartbeatTimer);
    clearInterval(this.epochTimer);
    this.peers.clear();
    this.taskClaims.clear();
    this.logger.info('P2P network stopped');
  }

  heartbeat() {
    const now = Date.now();
    for (const [peerId, peer] of this.peers) {
      if (now - peer.lastSeen > this.config.heartbeatIntervalMs * 3) {
        this.peers.delete(peerId);
        this.logger.debug('Peer timed out', { peerId });
      }
    }
  }

  advanceEpoch() {
    this.currentEpoch++;
    this.taskClaims.clear();
    this.logger.info('Epoch advanced', {
      epoch: this.currentEpoch,
      seed: this.vrf.getEpochSeed(this.currentEpoch).slice(0, 16),
    });
  }

  addPeer(peerId, metadata = {}) {
    if (this.peers.size >= this.config.maxPeers) {
      this.logger.warn('Max peers reached', { maxPeers: this.config.maxPeers });
      return false;
    }

    this.peers.set(peerId, {
      id: peerId,
      lastSeen: Date.now(),
      metadata,
      activeTasks: 0,
    });
    this.logger.debug('Peer added', { peerId });
    return true;
  }

  removePeer(peerId) {
    this.peers.delete(peerId);
    this.logger.debug('Peer removed', { peerId });
  }

  claimTask(taskId) {
    const existingClaim = this.taskClaims.get(taskId);
    if (existingClaim) {
      this.logger.debug('Task already claimed', {
        taskId,
        claimant: existingClaim.peerId,
      });
      return { claimed: false, claimant: existingClaim.peerId };
    }

    const priority = this.vrf.getDeterministicPriority(
      taskId,
      this.currentEpoch,
      this.peerId
    );

    this.taskClaims.set(taskId, {
      peerId: this.peerId,
      priority,
      timestamp: Date.now(),
      epoch: this.currentEpoch,
    });

    this.logger.info('Task claimed', { taskId, priority });
    return { claimed: true, priority };
  }

  resolveConflict(taskId, competingClaims) {
    if (competingClaims.length === 0) {
      return null;
    }

    const sortedClaims = competingClaims.sort((a, b) => b.priority - a.priority);
    const winner = sortedClaims[0];

    this.logger.info('Conflict resolved', {
      taskId,
      winner: winner.peerId,
      priority: winner.priority,
      totalClaims: competingClaims.length,
    });

    return winner;
  }

  broadcastGossip(message) {
    const gossipMessage = {
      type: 'task_claim',
      peerId: this.peerId,
      epoch: this.currentEpoch,
      timestamp: Date.now(),
      ...message,
    };

    this.logger.debug('Broadcasting gossip', {
      type: gossipMessage.type,
      taskId: message.taskId,
    });

    return gossipMessage;
  }

  handleGossipMessage(message) {
    if (message.peerId === this.peerId) {
      return null;
    }

    this.addPeer(message.peerId, { lastGossip: message.timestamp });

    switch (message.type) {
      case 'task_claim':
        return this.handleTaskClaim(message);
      case 'task_release':
        return this.handleTaskRelease(message);
      case 'heartbeat':
        return this.handleHeartbeat(message);
      default:
        this.logger.warn('Unknown gossip message type', { type: message.type });
        return null;
    }
  }

  handleTaskClaim(message) {
    const { taskId, peerId, priority } = message;

    if (!this.taskClaims.has(taskId)) {
      this.taskClaims.set(taskId, {
        peerId,
        priority,
        timestamp: message.timestamp,
        epoch: message.epoch,
      });
      return { accepted: true };
    }

    const existing = this.taskClaims.get(taskId);
    if (priority > existing.priority) {
      this.taskClaims.set(taskId, {
        peerId,
        priority,
        timestamp: message.timestamp,
        epoch: message.epoch,
      });
      return { accepted: true, replaced: existing.peerId };
    }

    return { accepted: false, reason: 'lower_priority' };
  }

  handleTaskRelease(message) {
    const { taskId, peerId } = message;
    const claim = this.taskClaims.get(taskId);

    if (claim && claim.peerId === peerId) {
      this.taskClaims.delete(taskId);
      return { released: true };
    }

    return { released: false, reason: 'not_claimant' };
  }

  handleHeartbeat(message) {
    return { acknowledged: true, peerId: this.peerId };
  }

  getNetworkState() {
    return {
      peerId: this.peerId,
      epoch: this.currentEpoch,
      epochSeed: this.vrf.getEpochSeed(this.currentEpoch).slice(0, 16),
      connectedPeers: this.peers.size,
      activeClaims: this.taskClaims.size,
      claims: Object.fromEntries(this.taskClaims),
    };
  }
}

module.exports = {
  GossipSubNetwork,
  VRFResolver,
  DEFAULT_CONFIG,
};
