/* eslint no-unused-vars: 0 */
/* eslint-env browser */

async function graphQl (query, variables = null) {
  const headers = new Headers()
  headers.append('X-CSRF-Token', window.THEMING.CSRFToken)

  const body = new FormData()
  body.append('graphql', JSON.stringify({ query, variables }))

  const res = await fetch('/theming/graphql', {
    method: 'post',
    credentials: 'same-origin',
    body,
    headers
  })

  return res.json()
}

async function exportTheme (themeId) {
  const job = await createExportThemeJob(themeId)
  await waitJob(job.id)
  return job.downloadUrl
}

function createExportThemeJob (themeId) {
  return graphQl(`
  mutation($input: CreateExportThemeJobInputType!) {
    createExportThemeJob(input: $input) {
      job_id,
      download_url
    }
  }`, { input: {theme_id: themeId} })
    .then(json => json.data.createExportThemeJob)
    .then(job => (
      {
        id: job.job_id,
        downloadUrl: job.download_url
      }
    ))
}

function createImportThemeJob () {
  return graphQl(`
  mutation{
    createImportThemeJob() {
      job_id,
      theme_id,
      upload_url,
      upload_params
    }
  }`)
    .then(json => json.data.createImportThemeJob)
    .then(job => (
      {
        id: job.job_id,
        themeId: job.theme_id,
        uploadUrl: job.upload_url,
        uploadParams: JSON.parse(job.upload_params)
      }
    ))
}

async function waitJob (jobId) {
  const status = await graphQl(`{job(id: "${jobId}") { status }}`)
    .then(json => {
      if (json.errors) throw new Error(json.errors[0].message)
      return json.data.job.status
    })

  return status === 'completed' || delay(250).then(() => waitJob(jobId))
}

function delay (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
