/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],

  /*
   * darkMode: 'media' means Tailwind dark: variants follow
   * the OS preference, same as our CSS custom properties.
   * Switch to 'class' if you add a manual dark mode toggle later.
   */
  darkMode: 'media',

  theme: {
    extend: {
      /* Brand colours */
      colors: {
        brand: {
          50:  '#EEEDFE',
          100: '#CECBF6',
          200: '#AFA9EC',
          400: '#7F77DD',
          600: '#534AB7',   /* primary buttons and active states */
          800: '#3C3489',
          950: '#26215C',
        },
        success: {
          50:  '#EAF3DE',
          200: '#97C459',
          600: '#3B6D11',
          800: '#27500A',
        },
        warning: {
          50:  '#FAEEDA',
          200: '#FAC775',
          600: '#854F0B',
          800: '#633806',
        },
        danger: {
          50:  '#FCEBEB',
          200: '#F09595',
          600: '#A32D2D',
          800: '#791F1F',
        },
        info: {
          50:  '#E6F1FB',
          200: '#85B7EB',
          600: '#185FA5',
          800: '#0C447C',
        },
      },

      /* Typography */
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Inter', 'Arial', 'sans-serif'],
        mono: ['Cascadia Code', 'Fira Code', 'JetBrains Mono', 'monospace'],
      },

      fontSize: {
        'xs':   ['11px', { lineHeight: '1.4' }],
        'sm':   ['13px', { lineHeight: '1.55' }],
        'base': ['14px', { lineHeight: '1.55' }],
        'lg':   ['16px', { lineHeight: '1.4'  }],
        'xl':   ['18px', { lineHeight: '1.3'  }],
        '2xl':  ['22px', { lineHeight: '1.3'  }],
      },

      fontWeight: {
        normal: '400',
        medium: '500',
        /* Avoid 600 and 700; they read too heavy against the UI. */
      },

      /* Spacing */
      /*
       * Tailwind's default 4px base is kept.
       * Use standard scale: p-1=4px, p-2=8px, p-3=12px, p-4=16px,
       * p-5=20px, p-6=24px, p-8=32px, p-10=40px, p-12=48px.
       * No custom values needed; the defaults are correct.
       */

      /* Border radius */
      borderRadius: {
        'sm':   '4px',
        'md':   '8px',
        'lg':   '12px',
        'xl':   '16px',
        'full': '9999px',
      },

      /* Border width */
      borderWidth: {
        'DEFAULT': '0.5px',   /* all borders are 0.5px; use border class */
        '0': '0',
        '1': '1px',
        '2': '2px',           /* reserved for featured/highlighted cards */
      },

      /* Sidebar width */
      width: {
        'sidebar': '220px',
      },

      /* Chat */
      maxWidth: {
        'chat': '680px',
        'bubble': '72%',
      },

      /* Z-index */
      zIndex: {
        'base':    '0',
        'raised':  '10',
        'overlay': '100',
        'modal':   '200',
        'toast':   '300',
      },

      /* Transitions */
      transitionDuration: {
        'fast':   '100ms',
        'normal': '180ms',
        'slow':   '300ms',
      },
    },
  },

  plugins: [],
}
