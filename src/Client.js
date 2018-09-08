import getBrowser from './getBrowser'
import url from 'url'
import download from 'download'
import path from 'path'
import s3Upload from './s3Upload'

export default class Client {
  constructor (browser, domain) {
    this._browser = browser
    this._domain = domain
    this._host = url.parse(domain).host
  }

  static async login ({domain, email, password}, browser) {
    if (!browser) browser = await getBrowser()

    const client = new this(browser, domain)

    if (!await client._attemptLogin(email, password)) {
      throw new Error('Login failed.')
    }

    return client
  }

  async _attemptLogin (email, password) {
    const page = await this._browser.newPage()

    // move login page
    await page.goto(this._url('/hc/signin'))
    if (await this._isLoggedIn(page)) return true

    const iframe = await (await page.$('iframe')).contentFrame()
    await iframe.waitFor('#login-form')

    // attempt login
    await iframe.type('#user_email', email)
    await iframe.type('#user_password', password)

    const p = new Promise(resolve => page.once('framenavigated', resolve))
    await iframe.$eval('form#login-form', form => form.submit())
    await p

    const result = await this._isLoggedIn(page)
    page.close()

    return result
  }

  async _isLoggedIn (page) {
    const cookies = await page.cookies()
    return cookies.some(cookie => cookie.name === '_zendesk_session')
  }

  _url (path) {
    return url.resolve(this._domain, path)
  }

  async downloadTheme (dest = path.join(process.cwd(), this._host)) {
    const themePage = await this._openThemePage()
    const [, themeId] = (await themePage.$eval('a[href^="/theming/theme"]', el => el.href)).match(/\/([^/]*?)$/)

    const downloadUrl = await themePage.evaluate(themeId => (
      exportTheme(themeId) // eslint-disable-line
    ), themeId)

    themePage.close()
    await download(downloadUrl, dest, { extract: true })
  }

  async uploadTheme (srcDir) {
    const themePage = await this._openThemePage()

    const job = await themePage.evaluate(() => (
      createImportThemeJob()// eslint-disable-line
    ))
    await this._s3Upload(job.uploadUrl, srcDir, job.uploadParams)
    await themePage.evaluate(jobId => (
      waitJob(jobId)// eslint-disable-line
    ), job.id)

    themePage.close()
  }

  async _s3Upload (url, srcDir, params) {
    const trackingUrl = await s3Upload(url, srcDir, params)
    const page = await this._browser.newPage()
    await page.goto(trackingUrl)
    page.close()
  }

  async _openThemePage () {
    const page = await this._browser.newPage()
    await page.goto(this._url('/theming/workbench'))
    await page.waitFor('a[href^="/theming/theme"]')
    await page.addScriptTag({path: path.resolve(__dirname, 'zendesk-helpers.js')})
    return page
  }
}
