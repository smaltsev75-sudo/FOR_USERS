import globals from 'globals';
import js from '@eslint/js';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.es2021
            }
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-console': 'off',
            'no-undef': 'error',
            'eqeqeq': ['error', 'always'],
            'no-var': 'error',
            'prefer-const': 'warn',
            'no-implicit-globals': 'error'
        }
    },
    {
        files: ['sw.js'],
        languageOptions: {
            globals: {
                ...globals.serviceworker
            }
        }
    },
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.jest,
                ...globals.node
            }
        }
    },
    {
        files: ['*.cjs'],
        languageOptions: {
            sourceType: 'commonjs',
            globals: {
                ...globals.node
            }
        }
    },
    {
        ignores: ['node_modules/', 'coverage/', 'playwright-report/', 'test-results/']
    }
];
