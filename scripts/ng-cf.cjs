#!/usr/bin/env node
/**
 * Cloudflare Pages / CI helper: run Angular CLI even when the
 * build image Node patch version is slightly below Angular's engines check.
 * (e.g. CF Node 24.13.1 vs Angular requiring 24.15.0)
 */
'use strict';

const path = require('path');

const cliRoot = path.dirname(require.resolve('@angular/cli/package.json'));
const nodeUtils = require(path.join(cliRoot, 'src/utilities/node-version'));

// Bypass hard exit on minor Node patch mismatch in hosted builders.
nodeUtils.isNodeVersionSupported = () => true;

require(path.join(cliRoot, 'bin/bootstrap'));
