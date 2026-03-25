/**
 * Shared Styles
 *
 * Base card styles used by all card types.
 */

import { css } from 'lit'

export const baseStyles = css`
  :host {
    display: block;
    /* Default GitHub Light Theme Colors */
    --gh-c-0: #ebedf0;
    --gh-c-1: #9be9a8;
    --gh-c-2: #40c463;
    --gh-c-3: #30a14e;
    --gh-c-4: #216e39;
  }

  @media (prefers-color-scheme: dark) {
    :host {
      --gh-c-0: #161b22;
      --gh-c-1: #0e4429;
      --gh-c-2: #006d32;
      --gh-c-3: #26a641;
      --gh-c-4: #39d353;
    }
  }

  /* Support class-based or attribute-based dark mode (e.g. from HA or Demo) */
  :host-context(.dark),
  :host-context([dark]) {
    --gh-c-0: #161b22;
    --gh-c-1: #0e4429;
    --gh-c-2: #006d32;
    --gh-c-3: #26a641;
    --gh-c-4: #39d353;
  }

  ha-card {
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--ha-card-background, var(--card-background-color, #fff));
    color: var(--primary-text-color);
  }

  .header {
    width: 100%;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin-bottom: 20px;
    color: var(--primary-text-color);
    text-align: left;
    font-family: var(
      --ha-font-family-body,
      -apple-system,
      BlinkMacSystemFont,
      'SF Pro Display',
      'Segoe UI',
      Roboto,
      sans-serif
    );
  }

  .tooltip {
    position: fixed;
    padding: 8px 12px;
    background: var(--primary-text-color);
    color: var(--ha-card-background, var(--card-background-color, #fff));
    border-radius: 8px;
    font-size: 12px;
    font-family: var(
      --ha-font-family-body,
      -apple-system,
      BlinkMacSystemFont,
      'SF Pro Text',
      'Segoe UI',
      Roboto,
      sans-serif
    );
    pointer-events: none;
    z-index: 1000;
    white-space: nowrap;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translate(-50%, -100%) translateY(-8px);
  }

  .tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: var(--primary-text-color);
  }

  .tooltip-date {
    font-weight: 600;
    margin-bottom: 2px;
  }

  .tooltip-count {
    opacity: 0.8;
    font-weight: 500;
  }

  .loading,
  .error,
  .empty {
    padding: 20px;
    text-align: center;
    color: var(--secondary-text-color);
    font-size: 14px;
  }

  .error {
    color: #d32f2f;
  }
`
