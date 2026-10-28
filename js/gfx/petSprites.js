// The heroes' pets (Sprites.pets[kind]): a cat, a dog, a bird, a flying fish and a pig, each facing right in a
// few poses: sit, walk (two steps), attack and rest (curled up, healing). Painted with the
// PixelArt toolkit like the keep's cats (propSprites.js): soft ramps, a dark outline, lit from
// the top-left. Each pose is { img, ax, ay } anchored at the bottom centre (the feet).

// the pet cat's coat: a tabby, so it doesn't pass for one of the keep's own cats
const PET_CAT_COAT = ['#5a3a24', '#8a6040', '#b8905e', '#e0c49a'];
const DOG_COAT = ['#5a3a1a', '#8a5a2a', '#c89a5a', '#ecc890'];
const PIG_SKIN = ['#a0465a', '#d86a82', '#ff9ab0', '#ffd0dc'];
const BIRD_FEATHERS = ['#1a3a7a', '#2a6ad0', '#6ab8ff', '#c8e8ff'];
const FISH_SCALES = ['#1a4a6a', '#2a8ab0', '#4ad0e8', '#c8f4ff'];

/** A dog facing right: sitting, walking (step 0/1), biting/barking (mouth open, ears up) or lying down. */
function petDog(p, mode, step) {
  const C = DOG_COAT;
  const nose = '#2a1a10';
  if (mode === 'rest') {
    p.round(1, 8, 16, 7, C[2], 3);                 // lying flat
    p.rect(3, 9, 10, 2, C[3]);
    p.line(1, 12, 0, 9, C[1]);                     // tail
    p.round(13, 6, 7, 6, C[2], 2);                 // head on its paws
    p.rect(14, 7, 2, 5, C[1]);                     // floppy ear
    p.rect(17, 9, 1, 1, nose); p.px(19, 9, nose);  // shut eye, nose
    p.rect(13, 13, 6, 2, C[3]);                    // paws
    return;
  }
  if (mode === 'sit') {
    p.round(3, 6, 10, 9, C[2], 3);                 // body
    p.rect(4, 7, 3, 7, C[3]);
    p.line(3, 13, 0, 10, C[1]);                    // tail
    p.round(9, 1, 9, 7, C[2], 3);                  // head
    p.rect(16, 4, 3, 3, C[3]);                     // snout
    p.px(18, 4, nose);
    p.rect(10, 1, 2, 6, C[1]);                     // floppy ear
    p.px(14, 3, nose);                             // eye
    p.rect(9, 8, 6, 1, '#d83a3a');                 // collar
    p.px(12, 9, '#ffd34a');                        // its tag
    p.rect(7, 14, 2, 1, C[3]); p.rect(11, 14, 2, 1, C[3]);
    return;
  }
  const bite = mode === 'attack';
  p.round(1, 5, 13, 6, C[2], 2);                   // body
  p.rect(2, 6, 10, 1, C[3]);
  p.line(1, 6, 0, step ? 1 : 2, C[1]);             // tail up, wagging
  p.round(11, bite ? 2 : 1, 7, 6, C[2], 2);        // head (dipped to bite)
  p.rect(17, bite ? 4 : 3, 3, 2, C[3]);            // snout
  p.px(19, bite ? 4 : 3, nose);
  if (bite) {
    p.rect(17, 6, 3, 2, '#5a1a1a');                // mouth open
    p.px(18, 6, '#ffffff');
    p.rect(12, 0, 2, 3, C[1]);                     // ear pricked up
  } else p.rect(12, 1, 2, 5, C[1]);                // floppy ear
  p.px(15, bite ? 3 : 2, nose);                    // eye
  p.rect(11, 7, 1, 3, '#d83a3a');                  // collar
  const a = step ? 1 : -1;
  for (const [x, s] of [[2, a], [4, -a], [10, a], [12, -a]]) p.rect(x + s, 10, 2, 5, C[1]);
}

/** A pig facing right: sitting, trotting (step 0/1), biting (head down, mouth open) or lying in a heap. */
function petPig(p, mode, step) {
  const C = PIG_SKIN;
  const eye = '#2a1a10';
  if (mode === 'rest') {
    p.ellipse(10, 10, 10, 5, C[2]);                // flopped over
    p.ellipse(8, 9, 6, 2, C[3]);
    p.circle(18, 9, 4, C[2]);                      // head
    p.ellipse(21, 10, 2, 2, C[1]);                 // snout
    p.px(21, 9, C[0]); p.px(21, 11, C[0]);
    p.rect(17, 8, 2, 1, eye);                      // shut eye
    p.poly([[15, 5], [17, 4], [17, 7]], C[1]);     // ear
    p.rect(3, 8, 1, 2, C[1]); p.px(2, 7, C[1]);    // curly tail
    return;
  }
  if (mode === 'sit') {
    p.round(3, 4, 13, 11, C[2], 4);                // round body
    p.rect(4, 5, 4, 8, C[3]);
    p.round(10, 1, 9, 8, C[2], 3);                 // head
    p.ellipse(19, 5, 2, 2, C[1]);                  // snout
    p.px(19, 4, C[0]); p.px(19, 6, C[0]);
    p.px(15, 3, eye);
    p.poly([[11, 2], [12, 0], [14, 2]], C[1]);     // ear
    p.rect(2, 7, 1, 2, C[1]); p.px(1, 6, C[1]);    // curly tail
    p.rect(7, 14, 3, 1, C[1]); p.rect(12, 14, 3, 1, C[1]);
    return;
  }
  const bite = mode === 'attack';
  p.ellipse(10, 8, 9, 5, C[2]);                    // barrel body
  p.ellipse(8, 6, 6, 2, C[3]);
  p.round(15, bite ? 4 : 2, 6, 7, C[2], 2);        // head
  p.ellipse(21, bite ? 8 : 6, 1, 2, C[1]);         // snout
  p.px(21, bite ? 7 : 5, C[0]);
  if (bite) { p.rect(18, 10, 3, 2, '#5a1a2a'); p.px(19, 10, '#ffffff'); }
  p.px(18, bite ? 5 : 4, eye);
  p.poly([[16, 3], [17, 0], [19, 3]], C[1]);       // ear
  p.rect(1, 5, 1, 2, C[1]); p.px(0, 4, C[1]);      // curly tail
  const a = step ? 1 : -1;
  for (const [x, s] of [[4, a], [6, -a], [13, a], [15, -a]]) p.rect(x + s, 11, 2, 4, C[1]);
  for (const [x, s] of [[4, a], [13, a]]) p.rect(x + s, 14, 2, 1, C[0]);   // trotters
}

/** A little round bird facing right: perched, flapping (wing up / down), pecking or puffed up asleep. */
function petBird(p, mode, step) {
  const C = BIRD_FEATHERS;
  const beak = ['#c87a1a', '#ffb02e'];
  if (mode === 'rest') {
    p.circle(7, 7, 5, C[2]);                       // fluffed into a ball
    p.ellipse(6, 8, 3, 3, C[3]);
    p.line(10, 7, 12, 6, beak[1]);
    p.rect(8, 5, 2, 1, '#1a1a2a');                 // shut eye
    p.rect(1, 6, 3, 2, C[1]);                      // tail
    return;
  }
  const peck = mode === 'attack';
  p.rect(0, 6, 4, 2, C[1]);                        // tail
  p.px(0, 8, C[0]);
  p.circle(7, 6, 4, C[2]);                         // body
  p.ellipse(7, 8, 3, 2, C[3]);                     // pale belly
  p.circle(peck ? 10 : 9, peck ? 5 : 3, 3, C[2]);  // head
  p.rect(peck ? 12 : 11, peck ? 5 : 3, 2, 1, beak[1]);   // beak
  p.px(peck ? 13 : 12, peck ? 6 : 4, beak[0]);
  p.px(peck ? 10 : 9, peck ? 4 : 2, '#1a1a2a');    // eye
  // wing: tucked when perched, up or down while flying
  if (mode === 'sit' || peck) p.ellipse(6, 6, 3, 2, C[1]);
  else if (step) p.poly([[4, 5], [8, 5], [3, 0]], C[1]);
  else p.poly([[4, 6], [8, 6], [3, 11]], C[1]);
  if (mode === 'sit') { p.px(6, 11, beak[0]); p.px(8, 11, beak[0]); }   // feet
}

/**
 * A flying fish facing right: hovering (fins spread), gliding (fins up / down), spitting (mouth
 * open, fins swept back) or flopped on the floor resting. Its big pectoral fins are its wings.
 */
function petFish(p, mode, step) {
  const C = FISH_SCALES;
  const fin = ['#3aa0c8', '#c8f4ff'];
  const eye = '#1a1a2a';
  if (mode === 'rest') {
    p.poly([[0, 7], [4, 9], [0, 12]], C[1]);       // tail
    p.ellipse(9, 10, 6, 2, C[2]);                  // lying on its side
    p.ellipse(9, 11, 4, 1, C[3]);
    p.rect(8, 8, 4, 1, C[3]);
    p.poly([[6, 9], [10, 9], [7, 6]], fin[0]);     // fin folded flat
    p.rect(12, 9, 2, 1, eye);                      // shut eye
    p.px(15, 10, C[0]);
    return;
  }
  const spit = mode === 'attack';
  // pectoral fins: level while hovering, swept back to spit, up or down while gliding
  const wing = mode === 'sit' ? [[6, 7], [11, 7], [3, 3]]
    : spit ? [[6, 7], [10, 7], [1, 5]]
      : step ? [[6, 6], [11, 6], [4, 0]] : [[6, 8], [11, 8], [4, 12]];
  p.poly([[0, 4], [4, 7], [0, 10]], C[1]);         // forked tail
  p.px(0, 7, C[0]);
  p.poly([[7, 5], [11, 5], [8, 2]], C[1]);         // dorsal fin
  p.ellipse(9, 7, 6, 3, C[2]);                     // body
  p.rect(7, 4, 4, 1, C[3]);                        // lit back (top left)
  p.rect(5, 6, 8, 1, C[1]);                        // a darker stripe down its side
  p.ellipse(9, 9, 4, 1, C[3]);                     // pale belly
  p.rect(12, 5, 2, 2, '#ffffff');                  // big eye
  p.px(13, 6, eye);
  if (spit) { p.rect(15, 7, 1, 2, '#123a5a'); p.px(15, 6, C[1]); }   // mouth open, spitting
  else p.px(15, 7, C[0]);
  p.poly(wing, fin[0]);
  p.line(wing[0][0], wing[0][1], wing[2][0], wing[2][1], fin[1]);   // the fin's bright leading edge
}

/** Builds Sprites.pets: { cat, dog, bird, fish, pig } -> { sit, walk: [a, b], attack, rest }. */
function buildPetSprites() {
  const poseOf = (w, h, draw) => ({ img: PixelArt.make(w + 2, h + 2, (p) => { p.ctx.translate(1, 1); draw(p); }, OUTLINE, 'soft'), ax: Math.round(w / 2) + 1, ay: h });
  const set = (w, h, fn) => ({
    sit: poseOf(w, h, (p) => fn(p, 'sit', 0)),
    walk: [poseOf(w, h, (p) => fn(p, 'walk', 0)), poseOf(w, h, (p) => fn(p, 'walk', 1))],
    attack: poseOf(w, h, (p) => fn(p, 'attack', 0)),
    rest: poseOf(w, h, (p) => fn(p, 'rest', 0)),
  });
  Sprites.pets = {
    // the cat reuses the keep cats' painter: pouncing is mid-stride, resting is curled up happy
    cat: {
      sit: poseOf(16, 14, (p) => cat(p, 'sit', 0, PET_CAT_COAT, '#3a8a2a')),
      walk: [poseOf(16, 14, (p) => cat(p, 'walk', 0, PET_CAT_COAT, '#3a8a2a')), poseOf(16, 14, (p) => cat(p, 'walk', 1, PET_CAT_COAT, '#3a8a2a'))],
      attack: poseOf(16, 14, (p) => cat(p, 'walk', 1, PET_CAT_COAT, '#3a8a2a')),
      rest: poseOf(16, 14, (p) => cat(p, 'happy', 0, PET_CAT_COAT, '#3a8a2a')),
    },
    dog: set(20, 15, petDog),
    pig: set(22, 15, petPig),
    bird: set(14, 12, petBird),
    fish: set(16, 12, petFish),
  };
}
