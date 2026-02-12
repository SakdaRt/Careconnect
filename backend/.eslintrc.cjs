module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  extends: ['eslint:recommended', 'plugin:import/recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  overrides: [
    {
      files: ['src/**/__tests__/**/*.js', 'src/**/*.test.js'],
      globals: {
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
      },
    },
  ],
  rules: {
    'no-console': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-shadow': 'off',
    'class-methods-use-this': 'off',
    'no-throw-literal': 'off',
    'no-return-await': 'off',
    'no-param-reassign': 'off',
    'no-plusplus': 'off',
    'no-await-in-loop': 'off',
    'no-restricted-syntax': 'off',
    'consistent-return': 'off',
    camelcase: 'off',
    quotes: 'off',
    'comma-dangle': 'off',
    radix: 'off',
    'operator-linebreak': 'off',
    'arrow-body-style': 'off',
    'import/extensions': 'off',
    'import/order': 'off',
  },
};

