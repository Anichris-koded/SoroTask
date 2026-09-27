import { expect, test } from '@playwright/test';
import { MockWalletProvider } from './helpers';

const VALID_CONTRACT_ADDRESS = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

test.describe('SoroTask critical paths', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tasks/create');
  });

  // Easy: Check homepage title
  test('homepage shows correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/SoroTask/);
  });

  // Medium: Test wallet connection modal opens
  test('wallet connection modal opens', async ({ page }) => {
    await page.getByTestId('connect-wallet-button').click();
    await expect(page.getByTestId('wallet-modal')).toBeVisible();
  });

  // Easy: Connect mock wallet
  test('connects a mock wallet', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Create Automation Task' })).toBeVisible();
    await page.getByTestId('connect-wallet-button').click();
    await expect(page.getByTestId('wallet-connected-button')).toBeVisible();
    await expect(page.getByTestId('wallet-connected-button')).toContainText('Futurenet');
  });

  // Advanced: Full automated mock-wallet integration test
  test('full flow: connect -> create task -> deposit gas -> pause -> verify state', async ({ page }) => {
    const mockWallet = new MockWalletProvider(page);

    // Step 1: Connect wallet
    await mockWallet.connect();
    await expect(page.getByTestId('wallet-connected-button')).toBeVisible();

    // Step 2: Create task
    await page.getByLabel('Target Contract Address').fill(VALID_CONTRACT_ADDRESS);
    await page.getByLabel('Function Name').fill('harvest_yield');
    await page.getByLabel('Interval (seconds)').fill('3600');
    await page.getByLabel('Gas Balance (XLM)').fill('10');

    const registerButton = page.getByRole('button', { name: /Register Task/i });
    await expect(registerButton).toBeEnabled();
    await registerButton.click();

    await expect(page.getByText('Task created successfully!')).toBeVisible();

    // Extract task ID from success message
    const taskId = await page.locator('[data-task-id]').getAttribute('data-task-id');

    // Step 3: Deposit gas
    await page.getByTestId('deposit-gas-button').click();
    await page.getByLabel('Gas Amount (XLM)').fill('5');
    await page.getByRole('button', { name: /Confirm Deposit/i }).click();
    await expect(page.getByText('Gas deposited successfully')).toBeVisible();

    // Step 4: Pause task
    await page.getByTestId(`task-${taskId}-pause-button`).click();
    await expect(page.getByText('Task paused')).toBeVisible();

    // Step 5: Verify state
    await page.goto('/tasks');
    const taskRow = page.locator(`[data-task-id="${taskId}"]`);
    await expect(taskRow).toBeVisible();
    await expect(taskRow).toContainText('PAUSED');
  });

  test('fills out and submits the task creation form', async ({ page }) => {
    await page.getByTestId('connect-wallet-button').click();
    await expect(page.getByTestId('wallet-connected-button')).toBeVisible();

    await page.getByLabel('Target Contract Address').fill(VALID_CONTRACT_ADDRESS);
    await page.getByLabel('Function Name').fill('harvest_yield');
    await page.getByLabel('Interval (seconds)').fill('3600');
    await page.getByLabel('Gas Balance (XLM)').fill('10');

    const registerButton = page.getByRole('button', { name: /Register Task/i });
    await expect(registerButton).toBeEnabled();
    await registerButton.click();

    await expect(page.getByText('Task created successfully!')).toBeVisible();
  });
});
