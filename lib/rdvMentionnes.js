// Rendez-vous mentionnés dans une note ou un message (« RDV chez le dentiste jeudi à 14 h ») :
// Holiris les relève et propose de les ajouter à l'agenda, en un clic, sous le message ou sur le tableau de bord.
import Groq from 'groq-sdk'
import { supabaseAdmin } from '@/lib/serveur'
import { enParis, instantParis } from '@/lib/passagesReguliers'
import { NOMS_JOURS } from '@/lib/horairesEnClair'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const JOUR = 24 * 3600 * 1000
const TYPES = ['medical', 'kine', 'pharmacy', 'care']

// Avant d'interroger l'IA : le texte parle d'un rendez-vous et donne un jour
const RDV = /\b(rdv|rendez|consult|convoc|docteur|dr|m[ée]decin|dentiste|ophtalmo|cardio|dermato|kin[ée]|labo|prise de sang|radio|scanner|irm|[ée]cho|examen|h[ôo]pital|clinique|coiffeu|p[ée]dicure|podologue|op[ée]ration|bilan|infirmi|vien|passer|pr[ée]vu)/i
const JOURS = /\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|demain|apr[èe]s[- ]demain|\d{1,2}[/.]\d{1,2}|\d{1,2}(er)? (janv|f[ée]v|mars|avr|mai|juin|juil|ao[ûu]t|sept|oct|nov|d[ée]c))/i

const CONSIGNE = `Tu lis une note ou un message écrit par l'entourage d'une personne âgée suivie à domicile (famille, aide à domicile, infirmier, kiné…).
Relève les rendez-vous À VENIR de la personne suivie dont le texte donne le jour : consultation, examen, soin, visite prévue à domicile, coiffeur…
Ne relève pas : ce qui a déjà eu lieu, un passage habituel sans date précise (« je passe tous les mardis »), une intention sans jour (« il faudrait prendre rendez-vous »), un rendez-vous de l'auteur ou d'une autre personne que la personne suivie.
Pour chaque rendez-vous :
- libelle : court, sans motif médical, ex. « Dentiste », « Prise de sang au laboratoire », « Rendez-vous chez le Dr Martin »
- date : AAAA-MM-JJ, d'après le calendrier fourni (« jeudi » = le prochain jeudi)
- heure : HH:MM si le texte la donne, sinon null
- type : "medical" seulement pour une consultation chez un médecin (généraliste ou spécialiste), "kine" pour la kinésithérapie, "pharmacy" pour la pharmacie, "care" pour tout le reste (dentiste, prise de sang, radio et autres examens, infirmier, coiffeur…)
Réponds UNIQUEMENT en JSON : {"rdv": [{"libelle": "...", "date": "AAAA-MM-JJ", "heure": "HH:MM" ou null, "type": "..."}]}, ou {"rdv": []} s'il n'y en a pas.`

// Aujourd'hui et les 3 semaines suivantes, en clair : l'IA y lit la date d'un « jeudi » ou d'un « demain »
function calendrier(maintenant) {
  const jours = []
  for (let i = 0; i < 21; i++) {
    const p = enParis(maintenant + i * JOUR)
    jours.push(`${i === 0 ? "aujourd'hui" : i === 1 ? 'demain' : NOMS_JOURS[p.jour]} ${p.date}`)
  }
  return jours.join(', ')
}

async function releverRdv(texte, maintenant) {
  const { minutes } = enParis(maintenant)
  const completion = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    reasoning_effort: 'low',
    response_format: { type: 'json_object' },
    max_completion_tokens: 600,
    messages: [
      { role: 'system', content: CONSIGNE },
      { role: 'user', content: `Écrit à ${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}, heure de Paris.\nCalendrier : ${calendrier(maintenant)}\n\nTexte :\n${texte}` },
    ],
  })
  const rdv = JSON.parse(completion.choices[0]?.message?.content || '{}').rdv
  return Array.isArray(rdv) ? rdv : []
}

// Rendez-vous du texte → propositions enregistrées (sauf ceux déjà à l'agenda ou déjà proposés).
// origine : { noteId } ou { messageId }. Ne lève jamais d'erreur : la note ou le message est déjà enregistré.
export async function proposerRdv({ seniorId, texte, noteId = null, messageId = null }) {
  try {
    if (!texte || !RDV.test(texte) || !JOURS.test(texte)) return []
    const maintenant = Date.now()
    const aujourdhui = enParis(maintenant).date
    const limite = enParis(maintenant + 366 * JOUR).date
    const trouves = (await releverRdv(texte, maintenant))
      .map(r => ({
        libelle: String(r.libelle || '').trim().slice(0, 120),
        date: String(r.date || ''),
        heure: /^([01]\d|2[0-3]):[0-5]\d$/.test(r.heure || '') ? r.heure : null,
        type: TYPES.includes(r.type) ? r.type : 'care',
      }))
      .filter(r => r.libelle && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.date >= aujourdhui && r.date <= limite)
      .filter(r => !r.heure || r.date > aujourdhui || r.heure > heureParis(maintenant))
      .slice(0, 3)
    if (!trouves.length) return []

    const debut = instantParis(trouves.reduce((a, r) => r.date < a ? r.date : a, trouves[0].date), '00:00')
    const fin = new Date(instantParis(trouves.reduce((a, r) => r.date > a ? r.date : a, trouves[0].date), '00:00').getTime() + JOUR)
    const [{ data: events }, { data: dejaProposes }] = await Promise.all([
      supabaseAdmin.from('events').select('type, scheduled_at').eq('senior_id', seniorId)
        .gte('scheduled_at', debut.toISOString()).lt('scheduled_at', fin.toISOString()),
      supabaseAdmin.from('propositions_rdv').select('date, type').eq('senior_id', seniorId).in('date', trouves.map(r => r.date)),
    ])

    const nouveaux = trouves.filter(r => {
      // Déjà proposé (le même rendez-vous cité dans une note puis dans un message)
      if ((dejaProposes || []).some(p => p.date === r.date && p.type === r.type)) return false
      // Déjà à l'agenda : même type, le même jour, à une heure près si l'heure est connue
      return !(events || []).some(e => {
        if (e.type !== r.type || enParis(e.scheduled_at).date !== r.date) return false
        return !r.heure || Math.abs(new Date(e.scheduled_at) - instantParis(r.date, r.heure)) <= 3600 * 1000
      })
    })
    if (!nouveaux.length) return []

    const { data, error } = await supabaseAdmin.from('propositions_rdv')
      .insert(nouveaux.map(r => ({ ...r, senior_id: seniorId, note_id: noteId, message_id: messageId }))).select()
    if (error) throw error
    return data
  } catch (error) {
    console.error('Erreur rendez-vous mentionnés:', error.message)
    return []
  }
}

function heureParis(instant) {
  const { minutes } = enParis(instant)
  return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0')
}

// Propositions dont l'utilisateur peut lire la note ou le message (règles d'accès de la base, client de l'utilisateur)
export async function propositionsVisibles(propositions, supabaseUtilisateur) {
  const notes = [...new Set(propositions.map(p => p.note_id).filter(Boolean))]
  const messages = [...new Set(propositions.map(p => p.message_id).filter(Boolean))]
  const [{ data: n }, { data: m }] = await Promise.all([
    notes.length ? supabaseUtilisateur.from('notes').select('id, intervenant_name').in('id', notes) : { data: [] },
    messages.length ? supabaseUtilisateur.from('messages').select('id, auteur_nom').in('id', messages) : { data: [] },
  ])
  const auteurs = new Map([
    ...(n || []).map(x => [x.id, (x.intervenant_name || 'Famille').split(' · ')[0]]),
    ...(m || []).map(x => [x.id, x.auteur_nom]),
  ])
  return propositions
    .filter(p => auteurs.has(p.note_id || p.message_id))
    .map(p => ({ ...p, auteur: auteurs.get(p.note_id || p.message_id) }))
}
