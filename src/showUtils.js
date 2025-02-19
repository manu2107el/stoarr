var { JSDOM } = require('jsdom')
const fs = require('fs')

function determinPlatform(url) {
    if (url.includes('aniworld.to')) {
        return 'https://aniworld.to/'
    } else if (url.includes('s.to')) {
        return 'https://s.to/'
    } else {
        throw new Error(
            'Error: Unsupported website. Please provide an aniworld.to or s.to link.'
        )
    }
}

async function getFullShow(seriesURL) {
    const seasons = await getSeasonLinks(seriesURL)
    const show = await Promise.all(
        seasons.map(async (season) => {
            return {
                season: season.season,
                seasonurl: season.url,
                episodes: await getSeasonVideoUrls(season.url),
            }
        })
    )
    return show
}

async function getSeasonLinks(seriesURL) {
    const originUrl = determinPlatform(seriesURL)
    const seriesResponse = await fetch(seriesURL)

    if (!seriesResponse.ok) {
        throw new Error(
            `Error: Failed to fetch ${seriesURL}: ${seriesResponse.status} ${seriesResponse.statusText}`
        )
    }

    const seriesHtml = await seriesResponse.text()
    const dom = new JSDOM(seriesHtml)
    const document = dom.window.document

    const potentialSeasonLinks = Array.from(
        document.querySelectorAll('a[href*="staffel"]')
    )
        .map((link) => {
            const href = link.getAttribute('href')
            return href && href.startsWith('http')
                ? href
                : originUrl + (href ? href.replace(/^\//, '') : '') // Simplified
        })
        .filter(Boolean) // More efficient filtering

    const seasonLinks = []
    const seenLinks = new Set()

    for (const link of potentialSeasonLinks) {
        const match = link.match(/staffel-(\d+)$/) // Combined regex and match
        if (match && !seenLinks.has(link)) {
            const seasonNumber = parseInt(match[1], 10)
            seasonLinks.push({ season: seasonNumber, url: link })
            seenLinks.add(link)
        }
    }

    seasonLinks.sort((a, b) => a.season - b.season) // Keep sorting

    if (seasonLinks.length === 0) {
        throw new Error(`Error: No seasons found on ${seriesURL}`)
    }

    return seasonLinks
}

async function getSeasonVideoUrls(seasonURL) {
    const originUrl = determinPlatform(seasonURL)
    const htmlResponse = await fetch(seasonURL)

    if (!htmlResponse.ok) {
        throw new Error(
            `Error: Failed to fetch ${seasonURL}: ${htmlResponse.status} ${htmlResponse.statusText}`
        )
    }

    const html = await htmlResponse.text()
    const dom = new JSDOM(html)
    const document = dom.window.document

    const episodeLinks = Array.from(
        document.querySelectorAll('ul > li > a[href*="episode"]')
    )
        .map((link) => {
            const href = link.getAttribute('href')
            return href && href.indexOf('/stream/') >= 0
                ? href.startsWith('http')
                    ? href
                    : originUrl + href.replace(/^\//, '')
                : null // combined and simplified
        })
        .filter(Boolean) // More efficient filtering

    if (episodeLinks.length === 0) {
        throw new Error(
            `Error: Could not retrieve episode list from url: ${seasonURL}`
        )
    }

    const episodeData = []

    for (const url of episodeLinks) {
        const match = url.match(/staffel-(\d+)\/episode-(\d+)/) // Combined regex and match
        if (match) {
            const season = parseInt(match[1], 10)
            const episode = parseInt(match[2], 10)
            episodeData.push({ season, episode, url }) // Shorthand property names
        }
    }

    return episodeData
}

async function getStreamUrl(
    episodeUrl,
    preferredLanguage = 'German',
    preferredProviders = ['Luluvdo', 'VOE', 'Streamtape']
) {
    const originUrl = determinPlatform(episodeUrl)
    try {
        const response = await fetch(episodeUrl)
        if (!response.ok) {
            throw new Error(
                `HTTP error! status: ${response.status} for URL: ${episodeUrl}`
            )
        }
        const htmlContent = await response.text()

        fs.writeFileSync('debug.html', htmlContent) // Debugging

        const langKeyMapping = extractLangKeyMapping(
            new JSDOM(htmlContent).window.document
        ) // Extract mapping *once*

        if (!langKeyMapping || Object.keys(langKeyMapping).length === 0) {
            return {
                provider: null,
                url: null,
                error: 'No language mapping found on this page.',
            }
        }

        if (!langKeyMapping[preferredLanguage]) {
            // Check if the preferred language exists
            return {
                provider: null,
                url: null,
                error: `No streams found in the preferred language (${preferredLanguage}). Available languages are: ${Object.keys(langKeyMapping).join(', ')}`,
            }
        }

        for (const provider of preferredProviders) {
            try {
                const streamUrl = getHrefByLanguage(
                    htmlContent,
                    preferredLanguage,
                    provider
                )
                if (streamUrl) {
                    return { provider: provider, url: originUrl + streamUrl }
                }
            } catch (providerError) {
                console.debug(
                    `Provider ${provider} unavailable for ${episodeUrl} in ${preferredLanguage}:`,
                    providerError.message
                )
            }
        }

        return {
            provider: null,
            url: null,
            error: `No stream URL found for ${episodeUrl} in ${preferredLanguage} with the preferred providers.`,
        }
    } catch (error) {
        console.error('Error fetching or processing stream URL:', error)
        return { provider: null, url: null, error: error.message }
    }
}

function getHrefByLanguage(htmlContent, language, provider) {
    const dom = new JSDOM(htmlContent)
    const document = dom.window.document
    const soup = document

    const langKeyMapping = extractLangKeyMapping(soup)

    if (!langKeyMapping) {
        throw new LanguageError(console.error('No language mapping found.'))
    }

    console.log(langKeyMapping)
    let langKey = langKeyMapping.hasOwnProperty(language)
        ? langKeyMapping[language]
        : undefined
    if (langKey === undefined) {
        const firstLang = Object.keys(langKeyMapping)[0]

        langKey = langKeyMapping[firstLang]
    }

    const liElements = soup.querySelectorAll(`li[data-lang-key="${langKey}"]`)
    let matchingLiElement = null

    for (const li of liElements) {
        const h4 = li.querySelector('a h4') // Select <h4> inside <a> inside <li>
        if (h4 && h4.textContent.trim() === provider) {
            matchingLiElement = li
            break
        }
    }
    console.log(matchingLiElement)
    if (matchingLiElement) {
        const href = matchingLiElement.getAttribute('data-link-target') || ''
        return href
    }
}
function extractLangKeyMapping(soup) {
    const langKeyMapping = {}
    const changeLanguageDiv = soup.querySelector('div.changeLanguageBox')

    if (changeLanguageDiv) {
        const langElements = changeLanguageDiv.querySelectorAll('img')
        langElements.forEach((langElement) => {
            const language =
                (langElement.getAttribute('alt') || '') +
                ',' +
                (langElement.getAttribute('title') || '')
            const dataLangKey = langElement.getAttribute('data-lang-key') || ''
            if (language && dataLangKey) {
                langKeyMapping[language] = dataLangKey
            }
        })
    }

    const ret = restructureDict(langKeyMapping)

    return ret
}

function restructureDict(langKeyMapping) {
    const restructured = {}
    for (const key in langKeyMapping) {
        const parts = key.split(',')
        restructured[parts[0]] = langKeyMapping[key]
    }
    return restructured
}

module.exports = {
    getSeasonVideoUrls,
    getSeasonLinks,
    getFullShow,
    determinPlatform,
}
