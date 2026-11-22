// Tailwind preset — reads the CSS variables from tokens.css
module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        'bg': 'var(--ms-bg)',
        'panel': 'var(--ms-panel)',
        'raised': 'var(--ms-raised)',
        'hover': 'var(--ms-hover)',
        'border': 'var(--ms-border)',
        'border-strong': 'var(--ms-border-strong)',
        'text': 'var(--ms-text)',
        'text-muted': 'var(--ms-text-muted)',
        'text-faint': 'var(--ms-text-faint)',
        'accent': 'var(--ms-accent)',
        'on-accent': 'var(--ms-on-accent)',
        'accent-text': 'var(--ms-accent-text)',
        'override': 'var(--ms-override)',
        status: {
          'delivered': 'var(--ms-status-delivered)',
          'soft-bounce': 'var(--ms-status-soft-bounce)',
          'hard-bounce': 'var(--ms-status-hard-bounce)',
          'complained': 'var(--ms-status-complained)',
          'deferred': 'var(--ms-status-deferred)',
          'failed': 'var(--ms-status-failed)',
          'suppressed': 'var(--ms-status-suppressed)',
        },
        conn: { resend: 'var(--ms-conn-resend)', brevo: 'var(--ms-conn-brevo)', smtp: 'var(--ms-conn-smtp)' },
      },
      fontFamily: { sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'], mono: ['JetBrains Mono', 'ui-monospace', 'monospace'] },
      borderRadius: { xs: '4px', sm: '6px', md: '8px', lg: '10px', xl: '14px' },
      transitionDuration: { fast: '120ms', base: '200ms' },
    },
  },
};
