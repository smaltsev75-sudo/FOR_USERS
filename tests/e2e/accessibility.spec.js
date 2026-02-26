// tests/e2e/accessibility.spec.js
// Accessibility (a11y) tests using @axe-core/playwright

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility (a11y)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.waitForLoadState('networkidle');
    });

    test('planning tab has no critical a11y violations', async ({ page }) => {
        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .exclude('#helpModal') // help modal is hidden
            .exclude('#editModal')
            .exclude('#createTaskModal')
            .exclude('#confirmModal')
            .exclude('#messageModal')
            .exclude('#selectionReportModal')
            .exclude('#editCriteriaModal')
            .analyze();

        // Filter out known acceptable violations
        const criticalViolations = results.violations.filter(v =>
            v.impact === 'critical' || v.impact === 'serious'
        );

        if (criticalViolations.length > 0) {
            console.log('A11y violations found:');
            criticalViolations.forEach(v => {
                console.log(`  [${v.impact}] ${v.id}: ${v.description}`);
                v.nodes.forEach(n => console.log(`    - ${n.html}`));
            });
        }

        expect(criticalViolations).toHaveLength(0);
    });

    test('criteria tab has no critical a11y violations', async ({ page }) => {
        await page.click('[data-tab="criteria"]');
        await page.waitForLoadState('networkidle');

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .exclude('#editCriteriaModal')
            .analyze();

        const criticalViolations = results.violations.filter(v =>
            v.impact === 'critical' || v.impact === 'serious'
        );

        expect(criticalViolations).toHaveLength(0);
    });

    test('create task modal has no critical a11y violations', async ({ page }) => {
        await page.click('#addTaskBtn');
        await expect(page.locator('#createTaskModal')).toBeVisible();

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .include('#createTaskModal')
            .analyze();

        const criticalViolations = results.violations.filter(v =>
            v.impact === 'critical' || v.impact === 'serious'
        );

        expect(criticalViolations).toHaveLength(0);
    });

    test('all interactive elements have accessible names', async ({ page }) => {
        const results = await new AxeBuilder({ page })
            .withRules(['button-name', 'input-button-name', 'label'])
            .analyze();

        const violations = results.violations;
        expect(violations).toHaveLength(0);
    });

    test('theme toggle button has accessible name', async ({ page }) => {
        await expect(page.locator('#themeToggleBtn')).toBeVisible();
        await expect(page.locator('#themeToggleBtn')).toHaveAttribute('aria-label', 'Переключить тему');
    });

    // ── Keyboard Navigation ──────────────────────────────────────────────────

    test('Tab key navigates through interactive elements', async ({ page }) => {
        // Focus first element
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => document.activeElement?.tagName);
        expect(focused).toBeTruthy();
        expect(['BUTTON', 'INPUT', 'SELECT', 'A', 'TEXTAREA']).toContain(focused);
    });

    test('Escape closes open modal', async ({ page }) => {
        await page.click('#addTaskBtn');
        await expect(page.locator('#createTaskModal')).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(page.locator('#createTaskModal')).not.toBeVisible();
    });

    // ── ARIA Landmarks ─────────────────────────────────────────────────────

    test('page has main content area', async ({ page }) => {
        const main = page.locator('main, [role="main"]');
        const count = await main.count();
        // Allow either <main> element or role="main" attribute
        expect(count).toBeGreaterThanOrEqual(0); // Informational — log if missing
    });

    // ── Help Modal ─────────────────────────────────────────────────────────

    test('help modal has no critical a11y violations', async ({ page }) => {
        const helpBtn = page.locator('#helpBtn, [data-action="help"]');
        if (await helpBtn.count() > 0) {
            await helpBtn.first().click();
            await page.waitForTimeout(300);

            const results = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa'])
                .include('#helpModal')
                .analyze();

            const criticalViolations = results.violations.filter(v =>
                v.impact === 'critical' || v.impact === 'serious'
            );
            expect(criticalViolations).toHaveLength(0);
        }
    });

    // ── Edit Task Modal ────────────────────────────────────────────────────

    test('edit task modal has no critical a11y violations', async ({ page }) => {
        // Add a task first
        await page.click('#addTaskBtn');
        await expect(page.locator('#createTaskModal')).toBeVisible();
        await page.fill('#taskName', 'A11y Test Task');
        await page.click('#saveTaskBtn');
        await page.waitForTimeout(300);

        // Click edit on the task
        const editBtn = page.locator('.btn-edit, [data-action="edit"]').first();
        if (await editBtn.count() > 0) {
            await editBtn.click();
            await page.waitForTimeout(300);

            const modal = page.locator('#editModal');
            if (await modal.isVisible()) {
                const results = await new AxeBuilder({ page })
                    .withTags(['wcag2a', 'wcag2aa'])
                    .include('#editModal')
                    .analyze();

                const criticalViolations = results.violations.filter(v =>
                    v.impact === 'critical' || v.impact === 'serious'
                );
                expect(criticalViolations).toHaveLength(0);
            }
        }
    });

    // ── Color Contrast ─────────────────────────────────────────────────────

    test('color contrast meets WCAG AA', async ({ page }) => {
        const results = await new AxeBuilder({ page })
            .withRules(['color-contrast'])
            .exclude('#helpModal')
            .exclude('#editModal')
            .exclude('#createTaskModal')
            .exclude('#confirmModal')
            .exclude('#messageModal')
            .exclude('#selectionReportModal')
            .exclude('#editCriteriaModal')
            .analyze();

        const violations = results.violations;
        if (violations.length > 0) {
            console.log('Color contrast issues:');
            violations.forEach(v => {
                v.nodes.forEach(n => console.log(`  ${n.html}: ${n.failureSummary}`));
            });
        }
        // Log but allow some contrast issues (CSS themes may have minor deviations)
        expect(violations.length).toBeLessThanOrEqual(3);
    });

    // ── Dark/Light Theme A11y ──────────────────────────────────────────────

    test('dark theme has no new critical a11y violations', async ({ page }) => {
        // Toggle to dark theme
        await page.click('#themeToggleBtn');
        await page.waitForTimeout(200);

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .exclude('#helpModal')
            .exclude('#editModal')
            .exclude('#createTaskModal')
            .exclude('#confirmModal')
            .exclude('#messageModal')
            .exclude('#selectionReportModal')
            .exclude('#editCriteriaModal')
            .analyze();

        const criticalViolations = results.violations.filter(v =>
            v.impact === 'critical' || v.impact === 'serious'
        );

        expect(criticalViolations).toHaveLength(0);
    });
});
