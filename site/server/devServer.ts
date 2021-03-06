import * as express from 'express'
require('express-async-errors')
import * as path from 'path'

import {renderFrontPage, renderPageBySlug, renderChartsPage, renderMenuJson, renderSearchPage, makeSitemap, renderDonatePage, entriesByYearPage, makeAtomFeed} from 'site/server/siteBaking'
import {chartPage, chartDataJson} from 'site/server/chartBaking'
import {BAKED_DEV_SERVER_PORT, BAKED_DEV_SERVER_HOST, BAKED_GRAPHER_URL} from 'settings'
import {WORDPRESS_DIR, BASE_DIR} from 'serverSettings'
import * as wpdb from 'db/wpdb'
import * as db from 'db/db'
import { expectInt, JsonError } from 'utils/server/serverUtil'
import { embedSnippet } from 'site/server/embedCharts'

const devServer = express()

devServer.get('/sitemap.xml', async (req, res) => {
    res.send(await makeSitemap())
})

devServer.get('/atom.xml', async (req, res) => {
    res.send(await makeAtomFeed())
})

devServer.get('/entries-by-year', async (req, res) => {
    res.send(await entriesByYearPage())
})

devServer.get(`/entries-by-year/:year`, async (req, res) => {
    res.send(await entriesByYearPage(parseInt(req.params.year)))
})

devServer.get('/grapher/data/variables/:variableIds.json', async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*')
    res.json(await chartDataJson((req.params.variableIds as string).split("+").map(v => expectInt(v))))
})

devServer.get('/grapher/embedCharts.js', async (req, res) => {
    res.send(embedSnippet())
})

devServer.get('/grapher/latest', async (req, res) => {
    const latestRows = await db.query(`SELECT config->>"$.slug" AS slug FROM charts where starred=1`)
    if (latestRows.length) {
        res.redirect(`${BAKED_GRAPHER_URL}/${latestRows[0].slug}`)
    } else {
        throw new JsonError("No latest chart", 404)
    }
})

devServer.get('/grapher/:slug', async (req, res) => {
    // XXX add dev-prod parity for this
    res.set('Access-Control-Allow-Origin', '*')
    res.send(await chartPage(req.params.slug))
})

devServer.get('/', async (req, res) => {
    res.send(await renderFrontPage())
})

devServer.get('/donate', async (req, res) => {
    res.send(await renderDonatePage())
})

devServer.get('/charts', async (req, res) => {
    res.send(await renderChartsPage())
})

devServer.get('/search', async (req, res) => {
    res.send(await renderSearchPage())
})

devServer.get('/headerMenu.json', async (req, res) => {
    res.send(await renderMenuJson())
})

devServer.use('/uploads', express.static(path.join(WORDPRESS_DIR, 'wp-content/uploads')))

devServer.use('/', express.static(path.join(BASE_DIR, 'public')))

devServer.get('/:slug', async (req, res) => {
    res.send(await renderPageBySlug(req.params.slug))
})

async function main() {
    await wpdb.connect()
    await db.connect()
    devServer.listen(BAKED_DEV_SERVER_PORT, BAKED_DEV_SERVER_HOST, () => {
        console.log(`OWID development baker started on ${BAKED_DEV_SERVER_HOST}:${BAKED_DEV_SERVER_PORT}`)
    })
}

main()