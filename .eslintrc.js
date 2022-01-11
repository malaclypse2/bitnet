module.exports = {
    "env": {
        "browser": true,
        "es2021": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": 13,
        "sourceType": "module"
    },
    "rules": {
        "no-constant-condition": ["error", {"checkLoops": false}],
        "no-unused-vars": ["warn", {"args": "none", "varsIgnorePattern": "^_"}],
    }
};
