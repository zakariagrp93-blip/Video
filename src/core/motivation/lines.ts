import type { MotivationTheme } from '../../shared/constants';

/**
 * Original motivation lines, written for this app. Line format:
 *   "<motif>[:<hero prop>][!]|<text>"
 * In the text, *word* = gold emphasis, ~word~ = red emphasis. "!" marks a hit
 * (impact + flash) — used for drops and the final line.
 */
export type Section = 'hook' | 'pain' | 'truth' | 'grind' | 'vision' | 'close';
export type LineBank = Record<Section, string[]>;

export const LINES: Record<'fr' | 'en', Record<MotivationTheme, LineBank>> = {
  fr: {
    money: {
      hook: [
        'skyline|Personne ne viendra te rendre *riche*.',
        'spotlight:sports-car|Ils veulent tous la *voiture*. Personne ne veut payer le *prix*.',
        "chess|L'argent ne récompense pas les rêveurs. Il récompense les *joueurs*.",
      ],
      pain: [
        'rain|Chaque matin, tu te lèves fatigué, pour un salaire qui ~disparaît~ en dix jours.',
        "crowd|Tu fais comme tout le monde. Et tu t'étonnes d'avoir la ~même vie~.",
        'alarm|Chaque mois, le même stress. Le même ~découvert~. La même promesse : le mois prochain.',
        'spotlight:credit-card|Acheter des choses pour impressionner des gens qui ne pensent ~même pas~ à toi.',
      ],
      truth: [
        "spotlight:money-stack|L'argent n'est pas le but. C'est la *liberté* de ne plus demander la permission.",
        'chess|Les riches achètent du *temps*. Les autres le vendent.',
        'spotlight:hourglass|Ton salaire paie tes factures. Ce que tu *construis* paie ta liberté.',
        "skyline|Personne n'est devenu riche en dépensant tout ce qu'il gagnait.",
        'spotlight:coin-stack|Un euro qui travaille pour toi travaille aussi pendant que tu *dors*.',
      ],
      grind: [
        "desk|Pendant qu'ils regardent des séries, toi, tu *apprends*.",
        "alarm|Cinq heures du matin. Pas d'excuse. Juste le *travail*.",
        'steps|Une marche par jour. Personne ne voit la montée. Tout le monde verra le *sommet*.',
        "road|Seul sur la route, sans applaudissements. C'est là que tout se *joue*.",
        "gym|La discipline d'aujourd'hui, c'est la *liberté* de demain.",
      ],
      vision: [
        'spotlight:mansion|Imagine-toi dans cinq ans. Plus de patron. Plus de *limite*.',
        "sunrise|Le jour où ta mère n'aura plus jamais à s'inquiéter pour l'*argent*.",
        'spotlight:yacht|Ils riront de toi au début. Ensuite, ils te demanderont *comment*.',
        'mountain|Le sommet est froid et silencieux. Mais la vue en vaut le *prix*.',
      ],
      close: [
        "skyline!|Alors arrête d'attendre. Commence *aujourd'hui*.",
        "sunrise!|Le meilleur moment pour commencer, c'était hier. Le deuxième, c'est *maintenant*.",
        'chess!|Tu ne joues pas pour gagner un mois. Tu joues pour gagner ta *vie*.',
      ],
    },
    discipline: {
      hook: [
        'alarm|La motivation te fait commencer. La *discipline* te fait continuer.',
        'gym|Personne ne se soucie de ce que tu *ressens*. Fais-le quand même.',
        'road|Les gens veulent le résultat. Très peu acceptent le *processus*.',
      ],
      pain: [
        "rain|Tu attends d'avoir envie. Mais l'envie ne vient ~jamais~.",
        'crowd|« Demain, je commence. » Voilà comment on gâche ~dix ans~.',
        'desk|Chaque excuse te coûte un jour. Et les jours ne ~reviennent~ pas.',
        'alarm|Le réveil sonne. Ton esprit négocie. Ta vie entière se joue dans ces ~cinq minutes~.',
      ],
      truth: [
        "gym|La discipline, c'est faire ce que tu détestes, comme si tu l'*aimais*.",
        'steps|Les petites actions répétées battent les grands plans *oubliés*.',
        'mountain|Le confort est une prison avec une très belle *vue*.',
        "chess|Maîtrise-toi, et personne ne pourra jamais te *contrôler*.",
        'spotlight:hourglass|Tu ne manques pas de temps. Tu manques de *priorités*.',
      ],
      grind: [
        "alarm|Pendant qu'ils dorment, toi, tu t'*entraînes*.",
        'gym|Encore une répétition. Encore une page. Encore une *heure*.',
        "road|Personne ne te regarde. C'est exactement là que tu *deviens* quelqu'un.",
        'desk|Pas de musique, pas de distraction. Juste toi et ton *objectif*.',
        'rain|Il pleut ? Tant mieux. Les autres sont restés *chez eux*.',
      ],
      vision: [
        'mountain|Un jour, ils appelleront ça de la *chance*.',
        "sunrise|Dans un an, tu remercieras celui qui n'a pas *abandonné*.",
        'stairs|Chaque jour difficile est une marche vers celui que tu *veux* être.',
      ],
      close: [
        'sunrise!|Personne ne viendra le faire à ta place. *Lève-toi*.',
        'gym!|Sois discipliné. Le reste *suivra*.',
        "alarm!|Demain n'existe pas. Il n'y a que *maintenant*.",
      ],
    },
    success: {
      hook: [
        "mountain|Ils t'ont dit que c'était *impossible*. Parfait.",
        'spotlight:trophy|Le succès ne se demande pas. Il se *prend*.',
        'chess|Tout le monde veut gagner. Personne ne veut se *préparer*.',
      ],
      pain: [
        "crowd|Ils ont ri de ton rêve. Parce qu'ils ont ~abandonné~ le leur.",
        'rain|Échouer fait mal. Ne jamais essayer fait ~pire~.',
        'road|Tu vas douter. Tu vas tomber. Tu vas vouloir ~tout lâcher~.',
        'desk|Des nuits sans résultat. Des efforts que ~personne~ ne voit.',
      ],
      truth: [
        "stairs|Le succès n'est pas un ascenseur. C'est un *escalier*.",
        "spotlight:diploma|Ce n'est pas le talent qui gagne. C'est la *persévérance*.",
        'chess|Les gagnants ne sont pas ceux qui ne tombent jamais. Ce sont ceux qui se *relèvent*.',
        "mountain|Chaque échec t'apprend ce qu'aucune école ne t'apprendra *jamais*.",
        'spotlight:hourglass|Le temps passera de toute façon. Autant le passer à *construire*.',
      ],
      grind: [
        'road|Avance, même lentement. Avance, même *seul*.',
        'desk|Travaille en silence. Laisse ton *succès* faire du bruit.',
        "gym|Chaque jour, un peu plus fort qu'*hier*.",
        "alarm|Pendant qu'ils parlent, toi, tu *agis*.",
        'stairs|Tombe sept fois. Relève-toi *huit*.',
      ],
      vision: [
        'spotlight:trophy|Un jour, ce seront eux qui *applaudiront*.',
        'skyline|Imagine la tête de ceux qui n’ont jamais cru en *toi*.',
        'sunrise|Le jour où tu regarderas en arrière, tu sauras que tout en valait la *peine*.',
      ],
      close: [
        "mountain!|Le sommet t'attend. *Monte*.",
        "spotlight:trophy!|Ne t'arrête pas quand tu es fatigué. Arrête-toi quand tu as *gagné*.",
        "sunrise!|Ton histoire n'est pas finie. Elle *commence*.",
      ],
    },
    mindset: {
      hook: [
        "rain|Ton plus grand ennemi, c'est la voix dans ta *tête*.",
        'chess|Change ta façon de penser, et tu changeras ta *vie*.',
        'crowd|Si tu veux une vie différente, arrête de penser comme les *autres*.',
      ],
      pain: [
        'rain|La peur te dit de rester où tu es. Bien au ~chaud~. Bien ~petit~.',
        'crowd|Tu te compares. Tu doutes. Tu ~te freines~ toi-même.',
        "desk|Ce n'est pas le manque de temps. C'est le manque de ~confiance~.",
        'road|Parfois, avancer veut dire laisser ~des gens~ derrière toi.',
      ],
      truth: [
        'chess|Tu ne contrôles pas ce qui arrive. Tu contrôles ta *réponse*.',
        "mountain|La solitude n'est pas une punition. C'est là que tu te *construis*.",
        'stairs|Chaque pensée est une graine. Choisis bien ce que tu *plantes*.',
        "sunrise|Les gens forts ne sont pas nés forts. Ils ont *décidé* de l'être.",
        "spotlight:lock|Le confort tue plus de rêves que l'*échec*.",
      ],
      grind: [
        'road|Protège ton énergie. Pas tout le monde mérite ton *attention*.',
        'desk|Lis. Apprends. Grandis. En *silence*.',
        'gym|Ton corps abandonne quand ton esprit abandonne. Alors *tiens bon*.',
        'alarm|Dis-toi chaque matin : aujourd’hui, je suis plus fort que mes *excuses*.',
        'steps|Petit à petit, la confiance se *gagne*.',
      ],
      vision: [
        "sunrise|Un jour, tu ne reconnaîtras plus la personne que tu étais. Et c'est *parfait*.",
        "mountain|Le calme après la tempête, c'est toi. *Invincible*.",
        "skyline|Quand ton esprit est en paix, rien ne peut t'*arrêter*.",
      ],
      close: [
        'chess!|Pense grand. Agis maintenant. Ne demande *rien*.',
        'sunrise!|Tu es exactement là où tu dois commencer. *Vas-y*.',
        'mountain!|Deviens la personne que tu aurais voulu *rencontrer*.',
      ],
    },
  },
  en: {
    money: {
      hook: [
        'skyline|Nobody is coming to make you *rich*.',
        'spotlight:sports-car|Everyone wants the *car*. Nobody wants to pay the *price*.',
        "chess|Money doesn't reward dreamers. It rewards *players*.",
      ],
      pain: [
        "rain|Every morning you wake up tired, for a paycheck that's ~gone~ in ten days.",
        'crowd|You do what everyone does. Then wonder why you have the ~same life~.',
        'alarm|Same stress every month. Same ~overdraft~. Same promise: next month.',
        'spotlight:credit-card|Buying things to impress people who ~never~ think about you.',
      ],
      truth: [
        "spotlight:money-stack|Money isn't the goal. It's the *freedom* to stop asking permission.",
        'chess|The rich buy *time*. Everyone else sells it.',
        'spotlight:hourglass|Your salary pays your bills. What you *build* pays for your freedom.',
        'skyline|Nobody ever got rich spending everything they earned.',
        'spotlight:coin-stack|Money that works for you keeps working while you *sleep*.',
      ],
      grind: [
        'desk|While they binge another series, you *learn*.',
        'alarm|Five a.m. No excuses. Just the *work*.',
        'steps|One step a day. Nobody sees the climb. Everyone will see the *top*.',
        "road|Alone on the road, no applause. That's where it's *decided*.",
        "gym|Today's discipline is tomorrow's *freedom*.",
      ],
      vision: [
        'spotlight:mansion|Picture yourself five years from now. No boss. No *ceiling*.',
        'sunrise|The day your mother never has to worry about *money* again.',
        "spotlight:yacht|They'll laugh at first. Then they'll ask you *how*.",
        'mountain|The top is cold and quiet. But the view is worth the *price*.',
      ],
      close: [
        'skyline!|So stop waiting. Start *today*.',
        'sunrise!|The best time to start was yesterday. The next best is *now*.',
        "chess!|You're not playing to win a month. You're playing to win your *life*.",
      ],
    },
    discipline: {
      hook: [
        'alarm|Motivation gets you started. *Discipline* keeps you going.',
        'gym|Nobody cares how you *feel*. Do it anyway.',
        'road|People want the result. Very few accept the *process*.',
      ],
      pain: [
        'rain|You wait until you feel like it. That feeling ~never~ comes.',
        "crowd|\"I'll start tomorrow.\" That's how ~ten years~ disappear.",
        "desk|Every excuse costs you a day. And days don't ~come back~.",
        'alarm|The alarm rings. Your mind negotiates. Your whole life is decided in those ~five minutes~.',
      ],
      truth: [
        'gym|Discipline is doing what you hate like you *love* it.',
        'steps|Small actions, repeated, beat big plans that get *forgotten*.',
        'mountain|Comfort is a prison with a beautiful *view*.',
        'chess|Master yourself, and no one will ever *control* you.',
        "spotlight:hourglass|You don't lack time. You lack *priorities*.",
      ],
      grind: [
        'alarm|While they sleep, you *train*.',
        'gym|One more rep. One more page. One more *hour*.',
        "road|Nobody is watching. That's exactly where you *become* someone.",
        'desk|No music, no distractions. Just you and the *goal*.',
        'rain|Raining? Good. Everyone else stayed *home*.',
      ],
      vision: [
        "mountain|One day they'll call it *luck*.",
        "sunrise|A year from now, you'll thank the version of you who didn't *quit*.",
        'stairs|Every hard day is a step toward who you *want* to be.',
      ],
      close: [
        'sunrise!|No one is coming to do it for you. *Get up*.',
        'gym!|Be disciplined. Everything else will *follow*.',
        "alarm!|Tomorrow doesn't exist. There is only *now*.",
      ],
    },
    success: {
      hook: [
        'mountain|They told you it was *impossible*. Perfect.',
        "spotlight:trophy|Success isn't given. It's *taken*.",
        'chess|Everyone wants to win. Nobody wants to *prepare*.',
      ],
      pain: [
        'crowd|They laughed at your dream. Because they ~gave up~ on theirs.',
        'rain|Failing hurts. Never trying hurts ~more~.',
        "road|You'll doubt. You'll fall. You'll want to ~quit~.",
        'desk|Nights with no results. Effort ~nobody~ sees.',
      ],
      truth: [
        "stairs|Success isn't an elevator. It's a *staircase*.",
        "spotlight:diploma|Talent doesn't win. *Persistence* does.",
        "chess|Winners aren't the ones who never fall. They're the ones who get back *up*.",
        'mountain|Every failure teaches you what no school ever *will*.',
        'spotlight:hourglass|Time will pass anyway. Might as well spend it *building*.',
      ],
      grind: [
        'road|Keep moving, even slowly. Keep moving, even *alone*.',
        'desk|Work in silence. Let your *success* make the noise.',
        'gym|Every day, a little stronger than *yesterday*.',
        'alarm|While they talk, you *act*.',
        'stairs|Fall seven times. Stand up *eight*.',
      ],
      vision: [
        "spotlight:trophy|One day, they'll be the ones *clapping*.",
        'skyline|Picture the faces of everyone who never believed in *you*.',
        'sunrise|The day you look back, you will know it was all *worth it*.',
      ],
      close: [
        'mountain!|The top is waiting. *Climb*.',
        "spotlight:trophy!|Don't stop when you're tired. Stop when you're *done*.",
        "sunrise!|Your story isn't over. It's just *beginning*.",
      ],
    },
    mindset: {
      hook: [
        'rain|Your biggest enemy is the voice in your *head*.',
        "chess|Change the way you think, and you'll change your *life*.",
        'crowd|If you want a different life, stop thinking like *everyone else*.',
      ],
      pain: [
        'rain|Fear tells you to stay where you are. ~Comfortable~. ~Small~.',
        'crowd|You compare. You doubt. You ~hold yourself back~.',
        "desk|It's not a lack of time. It's a lack of ~belief~.",
        'road|Sometimes moving forward means leaving ~people~ behind.',
      ],
      truth: [
        "chess|You don't control what happens. You control your *response*.",
        "mountain|Being alone isn't a punishment. It's where you *build* yourself.",
        'stairs|Every thought is a seed. Choose what you *plant*.',
        "sunrise|Strong people weren't born strong. They *decided* to be.",
        'spotlight:lock|Comfort kills more dreams than *failure* ever will.',
      ],
      grind: [
        'road|Protect your energy. Not everyone deserves your *attention*.',
        'desk|Read. Learn. Grow. In *silence*.',
        'gym|Your body quits when your mind quits. So *hold on*.',
        "alarm|Tell yourself every morning: today I'm stronger than my *excuses*.",
        'steps|Little by little, confidence is *earned*.',
      ],
      vision: [
        "sunrise|One day you won't recognise who you used to be. And that's *perfect*.",
        'mountain|The calm after the storm is you. *Unbreakable*.',
        'skyline|When your mind is at peace, nothing can *stop* you.',
      ],
      close: [
        'chess!|Think big. Act now. Ask for *nothing*.',
        "sunrise!|You're exactly where you need to start. *Go*.",
        "mountain!|Become the person you wish you'd *met*.",
      ],
    },
  },
};

export const HASHTAGS: Record<'fr' | 'en', Record<MotivationTheme, string[]>> = {
  fr: {
    money: ['#motivation', '#argent', '#mindset', '#richesse', '#entrepreneur'],
    discipline: ['#motivation', '#discipline', '#mindset', '#travail', '#objectif'],
    success: ['#motivation', '#reussite', '#succes', '#mindset', '#objectif'],
    mindset: ['#motivation', '#mental', '#mindset', '#confiance', '#developpementpersonnel'],
  },
  en: {
    money: ['#motivation', '#money', '#mindset', '#wealth', '#entrepreneur'],
    discipline: ['#motivation', '#discipline', '#mindset', '#grind', '#goals'],
    success: ['#motivation', '#success', '#winning', '#mindset', '#goals'],
    mindset: ['#motivation', '#mindset', '#mentalhealth', '#confidence', '#selfimprovement'],
  },
};
