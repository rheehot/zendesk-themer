#!/usr/bin/env node
const sade = require('sade')
const pkg = require('../package.json')
const prompts = require('prompts')
const loadJson = require('load-json-file')
const writeJson = require('write-json-file')
const normalizeUrl = require('normalize-url')
const path = require('path')
const fs = require('fs-extra')
const logger = require('./logger')

// commands
const down = require('./commands/down')
const up = require('./commands/up')

const prog = sade('themer')
prog.version(pkg.version)

prog
  .command('down')
  .describe('Download live theme.')
  .example('themer down')
  .example('themer down -config themer.json')
  .option('-c, --config', 'Load config file.')
  .action(async ({config}) => {
    const opts = await (config ? loadConf(config) : askOptsOrExit())
    const {err, downDir} = await down(opts)

    if (err || config) return

    const {willSaveConf} = await prompts({
      type: 'confirm',
      message: 'Do you want to save the current config?',
      name: 'willSaveConf'
    })

    if (willSaveConf) {
      const conf = Object.assign({target: './'}, opts)
      await writeJson(path.resolve(downDir, 'themer.json'), conf)
      logger.succeed('config saved.')
    }
  })

prog
  .command('up <src>')
  .describe('Upload a live theme.')
  .option('-p, --persist', 'No remove a old theme.')
  .example('themer up themes/test-theme/')
  .example('themer up themer.json')
  .action(async (src, {persist}) => {
    let opts
    if (src.endsWith('.json')) {
      opts = await loadConf(src)
    } else {
      try {
        opts = await loadConf(path.resolve(src, 'themer.json'))
      } catch (err) {
        opts = await askOptsOrExit()
      }
    }

    await up(opts, {persist})
  })

prog.parse(process.argv)

async function loadConf (conf) {
  const opts = await loadJson(conf)

  if ('target' in opts) {
    const confDir = path.dirname(await fs.realpath(conf))
    opts.target = path.resolve(confDir, opts.target)
  }

  return opts
}

function askOptsOrExit () {
  return prompts([
    {
      type: 'text',
      name: 'domain',
      message: 'Enter zendesk hc domain.',
      format: url => normalizeUrl(url)
    },
    {
      type: 'text',
      name: 'email',
      message: 'Enter zendesk email for login.'
    },
    {
      type: 'password',
      name: 'password',
      message: 'Enter zendesk password for login.'
    }
  ], {
    onCancel: process.exit
  })
}