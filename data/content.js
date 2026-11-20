// Curated bilingual activity content for the home page.
// Rendering, timers, and state live in scripts/main.js; edit copy and artwork
// references here. The object is deep-frozen so accidental mutations fail loudly.
//
// Shapes:
//   tips:     Array<{ en: string, es: string }>
//   looks:    Record<"bare" | "jacket" | "buddy", string>  // image paths
//   reactions:Array<{ say: { en: string, es: string } }>
//   palCards: Record<string, { art: string, page: number, rule: { en, es } }>
//   gamePool: Array<{
//     art: string,
//     alt: { en, es },
//     question: { en, es },
//     options: Array<{ en, es, correct?: boolean }>
//   }>

window.BOBBER_CONTENT = (function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
})({
  tips: [
    { en: "Wear your life jacket every time!", es: "¡Usa tu chaleco salvavidas siempre!" },
    { en: "Swim with a buddy!", es: "¡Nada acompañado!" },
    { en: "Reach or throw. Don’t go!", es: "¡Alcanza o lanza; no te metas!" },
    { en: "Cold water is sneaky—stay alert!", es: "Agua fría: ¡mantente alerta!" },
    { en: "Ask a grown-up before you go!", es: "¡Pregunta a un adulto antes de ir!" },
    { en: "Look out for each other!", es: "¡Cuídense entre todos!" },
    { en: "Check the weather before you go!", es: "¡Revisa el clima antes de salir!" },
    { en: "Jump in feet first!", es: "¡Salta con los pies primero!" },
    { en: "Stay in a grown-up’s sight!", es: "¡Quédate a la vista de un adulto!" },
    { en: "Take breaks and drink water!", es: "¡Toma descansos y bebe agua!" },
    { en: "Leave the water if you feel cold!", es: "¡Sal del agua si tienes frío!" },
    { en: "Look before you leap!", es: "¡Mira antes de saltar!" }
  ],

  looks: {
    bare: "assets/bobber/bobber-no-jacket.webp",
    jacket: "assets/bobber/bobber-sitting.webp",
    buddy: "assets/bobber/bobber-buddy.webp"
  },

  reactions: [
    { say: { en: "Life jacket on! You look great.", es: "¡Chaleco puesto! Te ves muy bien." } },
    { say: { en: "Buddy by your side!", es: "¡Tu compañero está contigo!" } },
    { say: { en: "A grown-up is watching. Nice!", es: "Un adulto está vigilando. ¡Bien!" } },
    { say: { en: "Reach or throw, not go!", es: "¡Alcanza o lanza, no te metas!" } }
  ],

  // Each pal opens their official 1-2-3 Splash trading card.
  palCards: {
    "Ranger Buck": {
      art: "assets/cards/splash/card-2.webp",
      page: 4,
      rule: { en: "Learn to swim and float well!", es: "¡Aprende a nadar y flotar bien!" }
    },
    "Ranger Jane": {
      art: "assets/cards/splash/card-3.webp",
      page: 5,
      rule: { en: "Get outdoors and play it safe!", es: "¡Disfruta al aire libre con seguridad!" }
    },
    "Ranger Toro": {
      art: "assets/cards/splash/card-4.webp",
      page: 6,
      rule: { en: "Learn to swim and float well!", es: "¡Aprenda a nadar y flotar bien!" }
    },
    "Corkey": {
      art: "assets/cards/splash/card-7.webp",
      page: 9,
      rule: { en: "Always swim with a buddy!", es: "¡Nada siempre acompañado!" }
    },
    "Sinker": {
      art: "assets/cards/splash/card-8.webp",
      page: 10,
      rule: { en: "Don’t trust inflatable toys!", es: "¡No confíes en los juguetes inflables!" }
    }
  },

  // The quiz draws four questions from this pool each time.
  gamePool: [
    {
      art: "assets/bobber/bobber-jacket-rack.webp",
      alt: { en: "Bobber next to a rack of life jackets", es: "Bobber junto a un perchero de chalecos salvavidas" },
      question: { en: "What should you put on before you get in a boat?", es: "¿Qué debes ponerte antes de subir a un bote?" },
      options: [
        { en: "A life jacket", es: "Un chaleco salvavidas", correct: true },
        { en: "A raincoat", es: "Un impermeable" },
        { en: "Sunglasses", es: "Gafas de sol" }
      ]
    },
    {
      art: "assets/bobber/bobber-lifebuoy.webp",
      alt: { en: "Bobber throwing a lifebuoy from a dock", es: "Bobber lanzando un salvavidas desde un muelle" },
      question: { en: "What should you do if someone is in trouble in the water?", es: "¿Qué debes hacer si alguien está en peligro en el agua?" },
      options: [
        { en: "Reach or throw something that floats", es: "Alcanzar o lanzar algo que flote", correct: true },
        { en: "Jump in to help", es: "Saltar al agua para ayudar" },
        { en: "Wait and do nothing", es: "Esperar sin hacer nada" }
      ]
    },
    {
      art: "assets/bobber/bobber-swim.webp",
      alt: { en: "Bobber swimming with a buddy", es: "Bobber nadando con un compañero" },
      question: { en: "Who should you swim with?", es: "¿Con quién debes nadar?" },
      options: [
        { en: "A buddy", es: "Con un compañero", correct: true },
        { en: "Nobody", es: "Con nadie" },
        { en: "A beach toy", es: "Con un juguete de playa" }
      ]
    },
    {
      art: "assets/bobber/bobber-boat.webp",
      alt: { en: "Bobber rowing a boat", es: "Bobber remando en un bote" },
      question: { en: "What should you check before a lake day?", es: "¿Qué debes revisar antes de un día en el lago?" },
      options: [
        { en: "The weather and water conditions", es: "El clima y las condiciones del agua", correct: true },
        { en: "Only the snack bag", es: "Solo la bolsa de bocadillos" },
        { en: "Nothing at all", es: "Nada" }
      ]
    },
    {
      art: "assets/bobber/bobber-jacket-rack.webp",
      alt: { en: "Bobber next to a rack of life jackets", es: "Bobber junto a un perchero de chalecos salvavidas" },
      question: { en: "How should a life jacket fit?", es: "¿Cómo debe quedar el chaleco salvavidas?" },
      options: [
        { en: "Snug and buckled", es: "Ajustado y abrochado", correct: true },
        { en: "Loose and open", es: "Suelto y abierto" },
        { en: "Two sizes too big", es: "Dos tallas más grande" }
      ]
    },
    {
      art: "assets/bobber/bobber-swim.webp",
      alt: { en: "Bobber swimming with a buddy", es: "Bobber nadando con un compañero" },
      question: { en: "What should you check before you jump into the water?", es: "¿Qué debes revisar antes de saltar al agua?" },
      options: [
        { en: "How deep it is", es: "Qué tan profunda es", correct: true },
        { en: "Whether your friends dare you", es: "Si tus amigos te animan" },
        { en: "Nothing—just jump", es: "Nada, solo saltar" }
      ]
    },
    {
      art: "assets/bobber/bobber-cold-water.webp",
      alt: { en: "Bobber beside cold water with a danger sign", es: "Bobber junto a agua fría con un letrero de peligro" },
      question: { en: "What should you do if you feel cold in the water?", es: "¿Qué debes hacer si sientes frío en el agua?" },
      options: [
        { en: "Get out and warm up", es: "Salir y calentarte", correct: true },
        { en: "Stay in longer", es: "Quedarte más tiempo" },
        { en: "Swim farther out", es: "Nadar más lejos" }
      ]
    },
    {
      art: "assets/bobber/bobber-swim.webp",
      alt: { en: "Bobber swimming with a buddy", es: "Bobber nadando con un compañero" },
      question: { en: "Can an inflatable toy replace a life jacket?", es: "¿Puede un juguete inflable sustituir un chaleco salvavidas?" },
      options: [
        { en: "No, never", es: "No, nunca", correct: true },
        { en: "Yes, always", es: "Sí, siempre" },
        { en: "Only in deep water", es: "Solo en agua profunda" }
      ]
    },
    {
      art: "assets/bobber/bobber-boat.webp",
      alt: { en: "Bobber rowing a boat", es: "Bobber remando en un bote" },
      question: { en: "What should you do when you hear thunder?", es: "¿Qué debes hacer cuando oyes truenos?" },
      options: [
        { en: "Leave the water right away", es: "Salir del agua de inmediato", correct: true },
        { en: "Keep swimming", es: "Seguir nadando" },
        { en: "Wait for the rain to stop", es: "Esperar a que pare la lluvia" }
      ]
    },
    {
      art: "assets/bobber/bobber-swim.webp",
      alt: { en: "Bobber swimming with a buddy", es: "Bobber nadando con un compañero" },
      question: { en: "Where should you swim?", es: "¿Dónde debes nadar?" },
      options: [
        { en: "In a designated swimming area", es: "En una zona designada para nadar", correct: true },
        { en: "Near a boat ramp", es: "Cerca de una rampa de botes" },
        { en: "Anywhere you like", es: "Donde quieras" }
      ]
    },
    {
      art: "assets/bobber/bobber-swim.webp",
      alt: { en: "Bobber swimming with a buddy", es: "Bobber nadando con un compañero" },
      question: { en: "What should you do before you swim?", es: "¿Qué debes hacer antes de nadar?" },
      options: [
        { en: "Ask a grown-up to watch", es: "Pedirle a un adulto que te vigile", correct: true },
        { en: "Swim first, tell later", es: "Nadar primero y avisar después" },
        { en: "Turn off the lights", es: "Apagar las luces" }
      ]
    },
    {
      art: "assets/bobber/bobber-boat.webp",
      alt: { en: "Bobber rowing a boat", es: "Bobber remando en un bote" },
      question: { en: "What should you wear when fishing from a boat?", es: "¿Qué debes llevar puesto cuando pescas desde un bote?" },
      options: [
        { en: "A life jacket", es: "Un chaleco salvavidas", correct: true },
        { en: "Heavy boots", es: "Botas pesadas" },
        { en: "A backpack", es: "Una mochila" }
      ]
    }
  ]
});
