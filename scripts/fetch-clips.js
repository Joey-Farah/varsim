#!/usr/bin/env node
// Usage: node scripts/fetch-clips.js <YOUTUBE_API_KEY>

import { writeFileSync, readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const API_KEY = process.argv[2]
if (!API_KEY) {
  console.error('Usage: node scripts/fetch-clips.js <YOUTUBE_API_KEY>')
  process.exit(1)
}

const CLIPS_PATH = resolve(__dirname, '../src/data/clips.json')
const MAX_PER_QUERY = 25

const SEARCH_QUERIES = [
  // Penalty decisions — competition-specific
  'Premier League VAR penalty decision 2024 referee',
  'Champions League penalty VAR review referee 2024',
  'La Liga VAR penalty decision referee 2024',
  'Premier League handball penalty box VAR 2024',
  'Champions League handball penalty decision VAR 2024',
  'Premier League penalty overturned VAR simulation 2024',
  'Euro 2024 VAR penalty decision referee controversial',

  // Red card decisions — competition-specific
  'Premier League red card VAR review referee 2024',
  'Champions League red card serious foul play 2024',
  'Premier League red card overturned VAR yellow card 2024',
  'Champions League red card rescinded VAR 2023 2024',
  'La Liga red card VAR review referee 2024',

  // Broader but still anchored to competitions
  'Premier League controversial referee decision VAR 2023',
  'Champions League controversial referee decision VAR 2023',
  'World Cup VAR penalty red card decision controversial',
]

const DECISION_LABEL = {
  no_foul: 'No Foul',
  foul: 'Foul / Free Kick',
  penalty: 'Penalty Kick',
  yellow_card: 'Yellow Card',
  red_card: 'Red Card',
}

function isQualityClip(title) {
  const t = title.toLowerCase()

  // Hard reject: compilations, explainers, fan edits, reactions
  if (/compilation|best\s+of|top\s+\d+|every\s+(penalty|red\s*card|foul)|rule(s)?\s+explain|how\s+to\s+ref|season\s+review|week\s+\d+\s+review|fan\s+edit|reaction\s+video|reacts?\s+to|funny\s+(referee|foul)|bloopers?/.test(t)) return false

  // Hard reject: excessive emojis (fan clickbait) — allow up to 5
  if ((title.match(/\p{Emoji_Presentation}/gu) ?? []).length > 5) return false

  // Must mention a real competition or specific team — generic "soccer foul" videos are useless
  const hasCompetition = /(premier\s+league|champions\s+league|\bucl\b|la\s+liga|bundesliga|serie\s+a|ligue\s+1|world\s+cup|euro\s+20\d\d|fa\s+cup|europa\s+league|\buel\b|copa\s+america|afcon|carabao|nations\s+league)/i.test(t)
  const hasTeam = /\b(united|man\s+city|arsenal|chelsea|liverpool|tottenham|spurs|real\s+madrid|barcelona|juventus|inter\s+milan|ac\s+milan|psg|dortmund|bayern|atletico|napoli|benfica|porto|ajax|celtic|newcastle|aston\s+villa|west\s+ham|sunderland|brentford|fulham|everton|leicester|wolves)\b/i.test(t)
  const hasYear = /20(1[6-9]|2[0-9])/.test(title)

  // Must have referee context AND at least one specificity signal
  const hasRefContext = /\b(VAR|referee|penalty|red\s+card|foul|handball|offside|var\s+review|straight\s+red)\b/i.test(t)

  return hasRefContext && (hasCompetition || hasTeam || hasYear)
}

// Parse ISO 8601 duration (e.g. PT4M23S) into total seconds
function parseDuration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return (parseInt(m[1] ?? 0) * 3600) + (parseInt(m[2] ?? 0) * 60) + parseInt(m[3] ?? 0)
}

function inferDecision(title, description) {
  const t = (title + ' ' + description.slice(0, 600)).toLowerCase()

  // Check no-penalty signals FIRST — before any penalty-positive patterns
  if (/penalty\s+(was\s+)?(overturned|reversed|denied|cancelled|canceled|rescinded|wrong|incorrect)\b/.test(t)) return 'no_foul'
  if (/\bvar\s+overturns?\s+(the\s+)?penalty\b/.test(t)) return 'no_foul'
  if (/\bno\s+penalty\b|\bnot\s+a\s+penalty\b/.test(t)) return 'no_foul'
  if (/(simulation|simulates?|diving|dives?).{0,40}(yellow|booked|card)/.test(t)) return 'no_foul'
  if (/(yellow|booking).{0,40}(simulation|dive|diving)/.test(t)) return 'no_foul'

  // Penalty awarded
  if (/penalty\s+(was\s+)?(awarded|given|stands|upheld|confirmed|correct)\b/.test(t)) return 'penalty'
  if (/\bawards?\s+a?\s*penalty\b/.test(t)) return 'penalty'
  if (/handball.{0,40}penalty/.test(t)) return 'penalty'

  // Red card downgraded to yellow
  if (/red\s+card\s+(overturned|reversed|rescinded|reduced|downgraded|changed\s+to\s+yellow)\b/.test(t)) return 'yellow_card'
  if (/yellow\s+card\s+instead\s+of\s+red\b/.test(t)) return 'yellow_card'
  if (/\bvar\s+(reduces?|downgrades?|changes?)\s.{0,20}red\b/.test(t)) return 'yellow_card'

  // Red card (not overturned)
  if (/\bstraight\s+red\s+card\b(?!.{0,80}(overturned|reversed|rescinded|reduced|yellow))/.test(t)) return 'red_card'
  if (/(serious\s+foul\s+play|violent\s+conduct).{0,80}red\s+card(?!.{0,80}(overturned|reversed))/.test(t)) return 'red_card'

  return null
}

function inferDecisions(title, decision) {
  const t = title.toLowerCase()

  if (/handball|simulation|diving/.test(t)) return ['no_foul', 'penalty']
  if (/penalty|spot\s+kick/.test(t)) return ['no_foul', 'penalty']
  if (/red\s+card|serious\s+foul|violent\s+conduct|straight\s+red/.test(t)) {
    if (decision === 'yellow_card') return ['yellow_card', 'red_card']
    return ['no_foul', 'foul', 'yellow_card', 'red_card']
  }

  if (decision === 'penalty' || decision === 'no_foul') return ['no_foul', 'penalty']
  if (decision === 'red_card') return ['no_foul', 'foul', 'yellow_card', 'red_card']
  if (decision === 'yellow_card') return ['yellow_card', 'red_card']
  return ['no_foul', 'foul', 'penalty', 'yellow_card', 'red_card']
}

function parseCompetition(title) {
  const t = title.toLowerCase()
  if (/premier\s+league/.test(t)) return 'Premier League'
  if (/champions\s+league|ucl\b/.test(t)) return 'UEFA Champions League'
  if (/europa\s+league|uel\b/.test(t)) return 'UEFA Europa League'
  if (/la\s+liga/.test(t)) return 'La Liga'
  if (/bundesliga/.test(t)) return 'Bundesliga'
  if (/serie\s+a/.test(t)) return 'Serie A'
  if (/ligue\s+1/.test(t)) return 'Ligue 1'
  if (/world\s+cup/.test(t)) return 'FIFA World Cup'
  if (/euro\s+20\d\d|european\s+championship/.test(t)) return 'UEFA Euro'
  if (/fa\s+cup/.test(t)) return 'FA Cup'
  if (/mls\b/.test(t)) return 'MLS'
  return 'Professional Soccer'
}

function parseTeams(title) {
  const m = title.match(/([A-Z][A-Za-z\s.]+?)\s+(?:vs?\.?|v\b)\s+([A-Z][A-Za-z\s.]+?)(?:\s*[-|–]|\s*\d|\s*$)/i)
  if (m) {
    const a = m[1].trim().replace(/\s+/g, ' ')
    const b = m[2].trim().replace(/\s+/g, ' ')
    if (a.length > 2 && a.length < 40 && b.length > 2 && b.length < 40) return `${a} vs ${b}`
  }
  return ''
}

function parseSeason(title, publishedAt) {
  const m = title.match(/20(1[6-9]|2[0-9])/)
  if (m) {
    const yr = parseInt(m[0])
    return `${yr}/${String(yr + 1).slice(2)}`
  }
  const yr = new Date(publishedAt).getFullYear()
  return `${yr - 1}/${String(yr).slice(2)}`
}

function parseStartSeconds(description) {
  const lines = description.split('\n').slice(0, 60).join('\n')

  // Priority: timestamps explicitly labelled near incident keywords
  const labeled = [
    /(?:incident|foul|challenge|tackle|penalty|handball|offence|offense|red\s+card|yellow\s+card|the\s+challenge|the\s+moment).{0,50}?(\d{1,2}):(\d{2})/i,
    /(\d{1,2}):(\d{2}).{0,50}(?:incident|foul|challenge|tackle|penalty|handball|card|moment)/i,
  ]
  for (const p of labeled) {
    const m = lines.match(p)
    if (m) {
      const mins = parseInt(m[1]), secs = parseInt(m[2])
      if (mins < 60) return mins * 60 + secs
    }
  }

  // Fallback: first timestamp that appears in a chapter/jump list (lines like "0:15 Something")
  const chapterLine = lines.match(/^(\d{1,2}):(\d{2})\s+\S/m)
  if (chapterLine) {
    const mins = parseInt(chapterLine[1]), secs = parseInt(chapterLine[2])
    if (mins < 60) return mins * 60 + secs
  }

  return 0
}

function generateContext(title, decision) {
  const t = title.toLowerCase()
  if (/handball/.test(t)) return "Ball strikes the defender's arm inside the penalty area. Was it in a natural position?"
  if (/simulation|diving|dive/.test(t)) return "The attacker goes down in the box under minimal contact. Penalty or simulation?"
  if (/violent\s+conduct/.test(t)) return "A dangerous off-the-ball incident. Does this deserve a red card?"
  if (/serious\s+foul|two.footed|studs/.test(t)) return "A reckless challenge in a dangerous area. What card does this deserve?"
  if (/straight\s+red|red\s+card/.test(t)) return "A challenge that had the referee reaching for a card. Red or yellow?"
  if (/penalty/.test(t)) return "A challenge inside the penalty area. Does this deserve a spot kick?"
  if (decision === 'penalty') return "Challenge in the box. Is this a penalty?"
  if (decision === 'red_card') return "A serious challenge. Is this a red card offence?"
  if (decision === 'yellow_card') return "A dangerous challenge. Red or yellow card?"
  if (decision === 'no_foul') return "The attacker goes down. Is this a foul or simulation?"
  return "A difficult call for the referee. What's your decision?"
}

function generateExplanation(title, description, decision) {
  const sentences = description
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 50 && s.length < 250)
    .filter(s => /(referee|VAR|penalty|card|foul|decision|awarded|overturned|incident|challenge|ruled)/i.test(s))

  if (sentences.length >= 1) return sentences.slice(0, 2).join(' ')

  const templates = {
    penalty: 'The referee awarded a penalty kick following this challenge. VAR reviewed the decision and it was upheld.',
    no_foul: 'The referee determined no foul had been committed. The contact was deemed insufficient, with the attacker adjudged to have gone down too easily.',
    red_card: 'The referee issued a straight red card for serious foul play. The challenge was deemed to endanger the safety of the opponent.',
    yellow_card: 'VAR intervened to downgrade the original red card to a yellow, judging the challenge as reckless but not meeting the threshold for serious foul play.',
    foul: 'The referee awarded a free kick for the foul. The challenge was judged careless or reckless.',
  }
  return templates[decision] ?? 'A controversial incident requiring a difficult call from the match official.'
}

async function searchYouTube(query) {
  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    videoCategoryId: '17',
    videoEmbeddable: 'true',
    videoDefinition: 'high',
    maxResults: String(MAX_PER_QUERY),
    relevanceLanguage: 'en',
    key: API_KEY,
  })
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Search failed (${res.status}): ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.items ?? []
}

async function getVideoDetails(videoIds) {
  if (!videoIds.length) return []
  const params = new URLSearchParams({
    part: 'snippet,status,contentDetails',
    id: videoIds.join(','),
    key: API_KEY,
  })
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`)
  if (!res.ok) throw new Error(`Video details failed (${res.status})`)
  const data = await res.json()
  return data.items ?? []
}

async function main() {
  console.log('\nVARSIM Clip Fetcher\n' + '='.repeat(40))

  let existing = []
  if (existsSync(CLIPS_PATH)) {
    try {
      existing = JSON.parse(readFileSync(CLIPS_PATH, 'utf-8'))
        .filter(c => c.youtubeId && c.youtubeId !== 'REPLACE_WITH_YOUTUBE_ID')
    } catch {}
  }
  const existingIds = new Set(existing.map(c => c.youtubeId))
  console.log(`Existing clips: ${existing.length}\n`)

  // Collect candidate video IDs across all search queries
  const candidateIds = new Set()
  for (const query of SEARCH_QUERIES) {
    process.stdout.write(`Searching: "${query}" ... `)
    try {
      const items = await searchYouTube(query)
      let added = 0
      for (const item of items) {
        const id = item.id?.videoId
        if (id && !existingIds.has(id)) { candidateIds.add(id); added++ }
      }
      console.log(`${added} new`)
    } catch (err) {
      console.log(`ERROR: ${err.message}`)
    }
    await new Promise(r => setTimeout(r, 250))
  }

  console.log(`\nFetching details for ${candidateIds.size} candidates...`)

  // Batch fetch video details (50 per request)
  const idsArr = [...candidateIds]
  const allVideos = []
  for (let i = 0; i < idsArr.length; i += 50) {
    const batch = idsArr.slice(i, i + 50)
    const details = await getVideoDetails(batch)
    allVideos.push(...details)
    await new Promise(r => setTimeout(r, 250))
  }

  // Process into clips
  const newClips = []
  let skippedEmbeddable = 0
  let skippedDuration = 0
  let skippedCompilation = 0
  let skippedUncertain = 0

  for (const video of allVideos) {
    if (video.status?.embeddable === false) { skippedEmbeddable++; continue }

    const durationSecs = parseDuration(video.contentDetails?.duration ?? 'PT0S')
    if (durationSecs > 720 || durationSecs < 10) { skippedDuration++; continue }

    const title = video.snippet?.title ?? ''
    if (!isQualityClip(title)) { skippedCompilation++; continue }

    const description = video.snippet?.description ?? ''
    const publishedAt = video.snippet?.publishedAt ?? ''

    const decision = inferDecision(title, description)
    if (!decision) { skippedUncertain++; continue }

    newClips.push({
      id: `clip_${video.id}`,
      youtubeId: video.id,
      title,
      competition: parseCompetition(title),
      season: parseSeason(title, publishedAt),
      teams: parseTeams(title),
      context: generateContext(title, decision),
      startSeconds: parseStartSeconds(description),
      decisions: inferDecisions(title, decision),
      decision,
      decisionLabel: DECISION_LABEL[decision],
      explanation: generateExplanation(title, description, decision),
      clipDuration: 15,
      varInvolved: /(VAR|video\s+assistant\s+referee)/i.test(title + description),
    })
  }

  console.log(`\nResults`)
  console.log(`  Candidates:        ${allVideos.length}`)
  console.log(`  Added:             ${newClips.length}`)
  console.log(`  Skipped (no embed):    ${skippedEmbeddable}`)
  console.log(`  Skipped (too long/short): ${skippedDuration}`)
  console.log(`  Skipped (compilation): ${skippedCompilation}`)
  console.log(`  Skipped (uncertain):   ${skippedUncertain}`)

  const finalClips = [...existing, ...newClips]
  writeFileSync(CLIPS_PATH, JSON.stringify(finalClips, null, 2))
  console.log(`\nWrote ${finalClips.length} total clips → ${CLIPS_PATH}`)
}

main().catch(err => {
  console.error('\nFatal error:', err.message)
  process.exit(1)
})
