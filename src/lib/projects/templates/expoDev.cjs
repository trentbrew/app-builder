'use strict';

/** Loads wc-preload then delegates argv to Expo CLI (keeps preload off Metro workers). */
require('./wc-preload.cjs');

const path = require('path');

const cliPath = path.join(__dirname, 'node_modules', 'expo', 'bin', 'cli');
process.argv.splice(1, 1, cliPath);
require(cliPath);
