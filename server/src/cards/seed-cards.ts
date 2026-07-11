import { CardType } from './card.schema';

const img = (seed: string) => `https://picsum.photos/seed/${seed}/200/280`;
const EXP = 'Hijos de Daana';

export interface SeedCard {
  nombre: string;
  tipo: CardType;
  fuerza: number;
  coste: number;
  historia: string;
  habilidad: string;
  bonus_fuerza?: number;
  raza?: string;
  special_abilities?: string[];
  tipo_sello: string;
  rareza: string;
  ilustrador: string;
  cantidad_edicion: number;
  numero_carta: number;
  image_url: string;
}

/** Initial global catalog, ported from the original mock cards. */
export const SEED_CARDS: SeedCard[] = [
  // ── Aliados ──
  { nombre: 'Guerrero Mapuche', tipo: 'aliado', fuerza: 4, coste: 3, historia: 'Valiente guerrero del pueblo Mapuche, defensor de su tierra y su gente.', habilidad: 'Al entrar al campo: roba una carta adicional.', tipo_sello: 'real', rareza: 'infrecuente', ilustrador: 'Carlos Reyes', cantidad_edicion: 150, numero_carta: 1, image_url: img('mapuche-warrior') },
  { nombre: 'Hechicera Ancestral', tipo: 'aliado', fuerza: 2, coste: 2, historia: 'Conocedora de los misterios del mundo espiritual, su magia es antigua y poderosa.', habilidad: 'Al atacar: el oponente descarta una carta al azar.', tipo_sello: 'ultra real', rareza: 'raro', ilustrador: 'María López', cantidad_edicion: 80, numero_carta: 2, image_url: img('ancestral-sorceress') },
  { nombre: 'Espíritu del Bosque', tipo: 'aliado', fuerza: 3, coste: 2, historia: 'El guardián ancestral del bosque, encarnación de la naturaleza misma.', habilidad: 'Regenerar: al ser destruido, regresa a tu mano.', tipo_sello: 'real', rareza: 'infrecuente', ilustrador: 'Carmen Vega', cantidad_edicion: 100, numero_carta: 6, image_url: img('forest-spirit') },
  { nombre: 'Chamán de la Luna', tipo: 'aliado', fuerza: 2, coste: 3, historia: 'Bajo la luz de la luna llena, el chamán invoca poderes más allá de la comprensión.', habilidad: 'Al jugar: roba 2 cartas del mazo oponente y deja ver.', tipo_sello: 'ultra real', rareza: 'raro', ilustrador: 'Roberto Díaz', cantidad_edicion: 90, numero_carta: 7, image_url: img('moon-shaman') },
  { nombre: 'Dragón de Fuego', tipo: 'aliado', fuerza: 7, coste: 6, historia: 'La bestia más temida de todos los mitos chilenos, domina el cielo con su fuego.', habilidad: 'Al atacar: inflige 2 de daño adicional a la vida del oponente.', tipo_sello: 'mega real', rareza: 'ultra raro', ilustrador: 'Sebastián Ruiz', cantidad_edicion: 30, numero_carta: 8, image_url: img('fire-dragon') },
  { nombre: 'Guardián de Piedra', tipo: 'aliado', fuerza: 5, coste: 4, historia: 'Esculpido por los dioses, este coloso defiende los templos sagrados.', habilidad: 'No puede ser destruido por efectos de cartas.', special_abilities: ['defensor'], tipo_sello: 'real', rareza: 'raro', ilustrador: 'Valentina Cruz', cantidad_edicion: 50, numero_carta: 9, image_url: img('stone-guardian') },
  { nombre: 'Sacerdotisa de Daana', tipo: 'aliado', fuerza: 1, coste: 1, historia: 'Devota de la diosa Daana, portadora de sus bendiciones divinas.', habilidad: 'Al jugar: recupera 2 puntos de vida.', tipo_sello: 'real', rareza: 'comun', ilustrador: 'Isabel Mendez', cantidad_edicion: 180, numero_carta: 11, image_url: img('daana-priestess') },
  { nombre: 'Luis Carrera', tipo: 'aliado', fuerza: 5, coste: 3, historia: 'Su poder en duelo era notable, y su fuerza legendaria. Su muerte no le hizo justicia a su vida.', habilidad: 'Caudillo. Indestructible. Indesterrable. Una vez por turno, puedes pagar 3 oros para jugar un Aliado Caudillo de coste 4 o menos desde tu Castillo sin pagar su Coste. Cada vez que sea bloqueado, un oponente bota 6 cartas.', raza: 'Caudillo', special_abilities: ['indestructible', 'indesterrable', 'invocacion_caudillo', 'castigo_bloqueo'], tipo_sello: 'real', rareza: 'ultra raro', ilustrador: 'Genzo', cantidad_edicion: 160, numero_carta: 21, image_url: '/cards/luis-carrera.jpg' },

  // ── Tótems ──
  { nombre: 'Tótem del Fuego', tipo: 'totem', fuerza: 0, coste: 2, historia: 'Una figura ancestral que canaliza el poder del fuego eterno.', habilidad: 'Permanente: tus aliados ganan +1 de fuerza al atacar.', tipo_sello: 'real', rareza: 'infrecuente', ilustrador: 'Diego Flores', cantidad_edicion: 120, numero_carta: 15, image_url: img('fire-totem') },
  { nombre: 'Tótem del Viento', tipo: 'totem', fuerza: 0, coste: 1, historia: 'El espíritu del viento guía a los guerreros en la batalla.', habilidad: 'Permanente: un aliado de tu elección puede atacar al turno de ser invocado.', tipo_sello: 'ultra real', rareza: 'raro', ilustrador: 'Laura Pizarro', cantidad_edicion: 100, numero_carta: 16, image_url: img('wind-totem') },
  { nombre: 'Tótem Guardián', tipo: 'totem', fuerza: 0, coste: 3, historia: 'Centinela eterno que protege a los suyos de todo mal.', habilidad: 'Permanente: al inicio de tu turno, recupera 1 punto de vida.', tipo_sello: 'mega real', rareza: 'ultra raro', ilustrador: 'Pedro Gómez', cantidad_edicion: 60, numero_carta: 17, image_url: img('guardian-totem') },

  // ── Talismanes ──
  { nombre: 'Talismán de Protección', tipo: 'talisman', fuerza: 0, coste: 1, historia: 'Un amuleto sagrado que libera su energía de un solo uso.', habilidad: 'Instantáneo: todos tus aliados en el campo ganan +2 de fuerza hasta el final del turno.', tipo_sello: 'real', rareza: 'comun', ilustrador: 'Pedro Soto', cantidad_edicion: 200, numero_carta: 3, image_url: img('protection-talisman') },
  { nombre: 'Llamada de los Ancestros', tipo: 'talisman', fuerza: 0, coste: 2, historia: 'Los espíritus de los antepasados acuden al llamado.', habilidad: 'Instantáneo: roba 2 cartas del Mazo Castillo.', tipo_sello: 'ultra real', rareza: 'raro', ilustrador: 'Ana Morales', cantidad_edicion: 80, numero_carta: 18, image_url: img('ancestor-call') },

  // ── Armas ──
  { nombre: 'Lanza del Trueno', tipo: 'arma', fuerza: 3, coste: 2, historia: 'Forjada en los cielos tormentosos, esta lanza jamás yerra.', habilidad: 'El aliado equipado gana +3 de fuerza.', bonus_fuerza: 3, tipo_sello: 'mega real', rareza: 'ultra raro', ilustrador: 'Ana Morales', cantidad_edicion: 120, numero_carta: 4, image_url: img('thunder-lance') },
  { nombre: 'Ballesta Élfica', tipo: 'arma', fuerza: 2, coste: 2, historia: 'Construida con madera de árbol milenario, nunca falla su disparo.', habilidad: 'El aliado equipado puede atacar al turno de ser jugada. +2 de fuerza.', bonus_fuerza: 2, tipo_sello: 'ultra real', rareza: 'infrecuente', ilustrador: 'Francisco Pinto', cantidad_edicion: 110, numero_carta: 12, image_url: img('elven-crossbow') },
  { nombre: 'Espada Sagrada', tipo: 'arma', fuerza: 1, coste: 1, historia: 'Bendecida por los dioses, esta espada es la ruina de los seres oscuros.', habilidad: 'El aliado equipado gana +1 de fuerza. Al derrotar un aliado: roba 1 carta.', bonus_fuerza: 1, tipo_sello: 'real', rareza: 'comun', ilustrador: 'Pedro Gómez', cantidad_edicion: 200, numero_carta: 13, image_url: img('sacred-sword') },
  { nombre: 'Hacha de Guerra', tipo: 'arma', fuerza: 2, coste: 2, historia: 'Forjada para el combate cuerpo a cuerpo, su filo no conoce la piedad.', habilidad: 'El aliado equipado gana +2 de fuerza.', bonus_fuerza: 2, tipo_sello: 'real', rareza: 'comun', ilustrador: 'Javier Núñez', cantidad_edicion: 150, numero_carta: 21, image_url: img('war-axe') },
  { nombre: 'Arco Largo del Cazador', tipo: 'arma', fuerza: 1, coste: 1, historia: 'Tallado por cazadores nómadas, alcanza blancos que el ojo apenas distingue.', habilidad: 'El aliado equipado gana +1 de fuerza y puede atacar aliados en la línea de apoyo.', bonus_fuerza: 1, tipo_sello: 'real', rareza: 'comun', ilustrador: 'Camila Rojas', cantidad_edicion: 180, numero_carta: 22, image_url: img('hunter-longbow') },
  { nombre: 'Balista de Asedio', tipo: 'arma', fuerza: 2, coste: 3, historia: 'Máquina de guerra capaz de derribar murallas sin manos que la empuñen.', habilidad: 'Maquinaria: puede jugarse en la línea de apoyo como un tótem. +2 de fuerza si se equipa.', bonus_fuerza: 2, special_abilities: ['maquinaria'], tipo_sello: 'ultra real', rareza: 'raro', ilustrador: 'Andrés Torres', cantidad_edicion: 70, numero_carta: 14, image_url: img('siege-ballista') },
  { nombre: 'Catapulta Ancestral', tipo: 'arma', fuerza: 3, coste: 4, historia: 'Reliquia de guerras olvidadas, dispara sola cuando huele la batalla.', habilidad: 'Maquinaria: puede jugarse en la línea de apoyo como un tótem. +3 de fuerza si se equipa.', bonus_fuerza: 3, special_abilities: ['maquinaria'], tipo_sello: 'mega real', rareza: 'ultra raro', ilustrador: 'Sofía Ramírez', cantidad_edicion: 40, numero_carta: 20, image_url: img('ancient-catapult') },
  { nombre: 'Fusil Grass Styer', tipo: 'arma', fuerza: 0, coste: 1, historia: 'Un arma de fusilamiento, clemente y veloz.', habilidad: 'Puedes pagar 1 Oro para que el portador gane 2 a la Fuerza hasta la Fase Final. No acumulable.', bonus_fuerza: 0, special_abilities: ['poder_temporal'], tipo_sello: 'real', rareza: 'comun', ilustrador: 'Genzo', cantidad_edicion: 160, numero_carta: 135, image_url: '/cards/fusil-grass-styer.jpg' },

  // ── Oro ──
  { nombre: 'Oro de los Incas', tipo: 'oro', fuerza: 0, coste: 0, historia: 'Moneda de oro puro, medio de intercambio del mundo antiguo.', habilidad: 'Oro: genera 1 de oro al ser jugada.', tipo_sello: 'real', rareza: 'comun', ilustrador: 'Diego Flores', cantidad_edicion: 300, numero_carta: 10, image_url: img('inca-gold') },
  { nombre: 'Moneda Ancestral', tipo: 'oro', fuerza: 0, coste: 0, historia: 'Una moneda tan antigua como el tiempo mismo.', habilidad: 'Oro: genera 1 de oro al ser jugada.', tipo_sello: 'real', rareza: 'comun', ilustrador: 'Luis Herrera', cantidad_edicion: 300, numero_carta: 19, image_url: img('ancient-coin') },
];

/**
 * Abilities with an implemented game interaction today.
 * categoria 'especial' = keyword acumulable; 'carta' = habilidad de carta con
 * mecánica propia (cualquier carta que la tenga puede ejecutarla).
 */
export const SEED_ABILITIES = [
  {
    code: 'maquinaria',
    nombre: 'Maquinaria',
    descripcion: 'Esta arma puede jugarse en la línea de apoyo como si fuera un tótem, sin necesidad de equiparse a un aliado.',
    implemented: true,
    categoria: 'especial',
  },
  {
    code: 'defensor',
    nombre: 'Defensor',
    descripcion: 'Este aliado no puede atacar; solo puede defender desde la línea de defensa.',
    implemented: true,
    categoria: 'especial',
  },
  {
    code: 'furia',
    nombre: 'Furia',
    descripcion: 'Este aliado puede atacar el mismo turno en que entra en juego, sin esperar a la siguiente Agrupación.',
    implemented: true,
    categoria: 'especial',
  },
  {
    code: 'indestructible',
    nombre: 'Indestructible',
    descripcion: 'Esta carta no va al Cementerio: los efectos que digan "Destruye" se anulan sobre ella, y en la Asignación de Daño sobrevive a la comparación de fuerzas aunque el aliado rival tenga Fuerza igual o mayor.',
    implemented: true,
    categoria: 'especial',
  },
  {
    code: 'indesterrable',
    nombre: 'Indesterrable',
    descripcion: 'Mientras esté en el campo de batalla, ningún efecto puede enviar esta carta a la Zona de Destierro: los destierros con objetivo fallan al resolverse sobre ella y los destierros masivos la ignoran.',
    implemented: true,
    categoria: 'especial',
  },
  {
    code: 'instantaneo',
    nombre: 'Instantáneo',
    descripcion: 'Este talismán puede jugarse fuera de la Vigilia y de la Guerra de Talismanes, en cualquier momento según indique su habilidad.',
    implemented: true,
    categoria: 'especial',
  },
  {
    code: 'invocacion_caudillo',
    nombre: 'Invocación Caudillo',
    descripcion: 'Una vez por turno, paga 3 Oros: busca en tu Mazo Castillo un Aliado de la misma raza con coste 4 o menos y juégalo sin pagar su coste.',
    implemented: true,
    categoria: 'carta',
  },
  {
    code: 'castigo_bloqueo',
    nombre: 'Castigo al bloqueo',
    descripcion: 'Cada vez que este aliado ataque y sea bloqueado, el jugador defensor bota 6 cartas de su Mazo Castillo a su Cementerio.',
    implemented: true,
    categoria: 'carta',
  },
  {
    code: 'poder_temporal',
    nombre: 'Poder temporal',
    descripcion: 'Paga 1 Oro para que el portador gane +2 de Fuerza hasta la Fase Final. No acumulable.',
    implemented: true,
    categoria: 'carta',
  },
  {
    code: 'fuerza_inmutable',
    nombre: 'Fuerza inmutable',
    descripcion: 'Mientras esta carta esté en juego, los Aliados oponentes no pueden modificar su Fuerza: sus bonos de armas y efectos temporales quedan sin efecto y pelean con su Fuerza impresa.',
    implemented: true,
    categoria: 'carta',
  },
  {
    code: 'unica',
    nombre: 'Única',
    descripcion: 'Restricción de construcción de mazo: solo puedes incluir 1 copia de esta carta en todo tu Castillo (la regla general permite hasta 3 copias por mazo de 50).',
    implemented: true,
    categoria: 'especial',
  },
  {
    code: 'solo_desde_mano',
    nombre: 'Solo desde la mano',
    descripcion: 'Restricción: esta carta solo puede ser jugada desde la mano de su propietario. No puede entrar en juego por efectos ni habilidades, ni usarse como oro inicial.',
    implemented: true,
    categoria: 'carta',
  },
  {
    code: 'imbloqueable',
    nombre: 'Imbloqueable',
    descripcion: 'Cuando este aliado ataca, el defensor no puede declararle bloqueador: el daño va directo al Mazo Castillo (la Guerra de Talismanes ocurre igual).',
    implemented: true,
    categoria: 'especial',
  },
  {
    code: 'inmunidad_talismanes',
    nombre: 'Inmunidad: Talismanes',
    descripcion: 'Los talismanes no tienen ningún efecto sobre esta carta: los efectos de talismán con objetivo fallan sobre ella y los masivos la ignoran (p.ej. "Destruye un aliado en juego" no la destruye).',
    implemented: true,
    categoria: 'especial',
  },
  {
    code: 'patriotas_no_anulables',
    nombre: 'Patriotas no anulables',
    descripcion: 'Mientras esta carta esté en juego, tus Aliados Patriota no pueden ser anulados: los efectos "Anula…" con objetivo fallan sobre ellos y las anulaciones masivas los ignoran.',
    implemented: true,
    categoria: 'carta',
  },
  {
    code: 'relampago',
    nombre: 'Relámpago',
    descripcion: 'Esta carta puede jugarse en cualquier momento en que por regla podría jugarse un Talismán: durante el turno rival, como bloqueador sorpresa ante un ataque declarado, o en la Fase Final del oponente — pagando su Coste normal.',
    implemented: true,
    categoria: 'especial',
  },
  {
    code: 'agrupar_fase_final',
    nombre: 'Agrupar en Fase Final',
    descripcion: 'Al comienzo de cada Fase Final (de cualquier jugador), agrupa todas las cartas que controle el propietario de esta carta: sus oros pagados vuelven a la reserva y sus atacantes regresan enderezados a la defensa.',
    implemented: true,
    categoria: 'carta',
  },
  {
    code: 'botar3_destruye',
    nombre: 'Botar 3: destruir',
    descripcion: 'Puedes botar 3 cartas de tu Mazo Castillo al Cementerio para destruir un Aliado objetivo (falla contra Indestructible y "No sale del juego").',
    implemented: true,
    categoria: 'carta',
  },
  {
    code: 'inanulable',
    nombre: 'Inanulable',
    descripcion: 'Esta carta no puede ser anulada por ninguna carta: toda anulación falla sobre ella.',
    implemented: true,
    categoria: 'carta',
  },
  {
    code: 'no_sale_del_juego',
    nombre: 'No sale del juego',
    descripcion: 'Esta carta no puede salir del juego por ningún medio: destrucción, remoción, destierro o retorno fallan sobre ella mientras esté en el campo.',
    implemented: true,
    categoria: 'carta',
  },
  {
    code: 'barajar_mano_roba8',
    nombre: 'Barajar mano y robar 8',
    descripcion: 'Cuando esta carta entra en juego, puedes barajar tu Mano en tu Mazo Castillo (el mazo se re-aleatoriza); si lo haces, robas 8 cartas nuevas.',
    implemented: true,
    categoria: 'carta',
  },
  {
    code: 'fuerza1_no_caudillos',
    nombre: 'Fuerza 1 a no-Caudillos',
    descripcion: 'Mientras esta carta esté en el tablero, todos los Aliados que no sean de raza Caudillo tienen Fuerza 1 (fija, ignora bonos). Afecta a ambos jugadores.',
    implemented: true,
    categoria: 'carta',
  },
  {
    code: 'jugar_desde_cementerio',
    nombre: 'Jugar desde Cementerio/Destierro',
    descripcion: 'Puedes jugar esta carta desde tu Cementerio o tu Destierro como si estuviera en tu Mano, pagando su Coste normal. Las zonas con cartas jugables brillan doradas.',
    implemented: true,
    categoria: 'carta',
  },
  {
    code: 'bonus_patriotas',
    nombre: 'Bonus a Patriotas (+1)',
    descripcion: 'Mientras esta carta esté en el tablero (línea de ataque o defensa), TODOS los Aliados de raza Patriota — de ambos jugadores, incluida ella misma — ganan +1 a la Fuerza.',
    implemented: true,
    categoria: 'carta',
  },
  {
    code: 'talisman_reciclado',
    nombre: 'Talismán reciclado',
    descripcion: 'Una vez por turno, puedes jugar un Talismán desde tu Cementerio o Destierro reduciendo su Coste en 3 (mínimo 0). Tras resolverse, ese talismán se remueve del juego.',
    implemented: true,
    categoria: 'carta',
  },
  {
    code: 'orbe',
    nombre: 'Orbe',
    descripcion: 'Restricción de construcción de mazo (la más estricta): solo puedes tener UNA carta con la habilidad Orbe en todo tu Mazo Castillo, sin importar su nombre — prohíbe la segunda copia y cualquier otra carta Orbe distinta.',
    implemented: true,
    categoria: 'especial',
  },
  {
    code: 'anular_respuesta',
    nombre: 'Anulación en respuesta',
    descripcion: 'Talismán de respuesta: durante la ventana de 10 s tras jugarse un Aliado o Talismán rival, puedes jugarlo para ANULAR esa carta — la carta anulada se remueve del juego (zona R) y robas tantas cartas como su Coste. Respeta Inmunidad: Talismanes y la protección de Patriotas.',
    implemented: true,
    categoria: 'carta',
  },
  {
    code: 'oro_inicial',
    nombre: 'Oro Inicial',
    descripcion: 'Keyword de preparación: la regla general exige que el oro inicial de la partida sea un Oro básico (sin habilidades); una carta con Oro Inicial también puede colocarse como tu primer oro del juego.',
    implemented: true,
    categoria: 'especial',
  },
  {
    code: 'oro_robar_descartar',
    nombre: 'Robar y descartar',
    descripcion: 'Una vez por turno, si controlas al menos un Aliado Patriota, puedes pagar este Oro (moverlo a tu Zona de Oro Pagado) para robar 1 carta de tu Mazo Castillo y luego descartar obligatoriamente 1 carta de tu mano. Activable en cualquier fase, en tu turno o en el del oponente.',
    implemented: true,
    categoria: 'carta',
  },
  {
    code: 'debilitar_aliado',
    nombre: 'Debilitar aliado',
    descripcion: 'En tu Vigilia, puedes pagar 1 Oro para que un Aliado objetivo en juego tenga Fuerza 0 hasta la Fase Final. Repetible mientras tengas oro.',
    implemented: true,
    categoria: 'carta',
  },
  {
    code: 'oro_talismanes',
    nombre: 'Oro para Talismanes',
    descripcion: 'Puedes pagar este Oro (moverlo a tu Zona de Oro Pagado) para generar 2 Oros que solo pueden usarse para jugar Talismanes. Activable durante tu turno o el del oponente; los Oros generados expiran al final del turno.',
    implemented: true,
    categoria: 'carta',
  },
];
