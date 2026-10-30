// The board's style bible: a painted ink-and-watercolour adventure map on warm parchment (the three reference
// images in reference-samples/). One palette, one sepia ink, one light. The landmark painting prompts
// (art-src/PROMPTS.md) quote these, so the painted buildings sit in the same world as the painted map.
export const INK = '#3a2a1a';
// The afternoon sun from the west-south-west, as in the Blender relief pass. The camera looks east, so on screen
// the light comes from below and a little right: fronts facing the viewer are lit, shadows fall up and a little left.
export const LIGHT = { toSun: [0.34, 0.94], shadowDir: [-0.34, -0.94] };

export const DAY = {
  parchment: '#ead9b0', parchmentDark: '#b8955c',
  meadow: '#a3c15f', meadowLight: '#bfd383', forestFloor: '#557f3a', town: '#e2cfa3', lawn: '#9ccb5b',
  shadowTint: [52, 84, 70], highlight: [255, 244, 190], haze: [196, 214, 200],
  sky: ['#f4e8c8', '#d7e6e2'], cloud: 'rgba(255,252,240,0.9)',
  ridges: ['#b9cdc8', '#9dbcb2', '#82aa95', '#6a9a72'],
  water: ['#7cc6e4', '#2f86bb'], waterBand: 'rgba(210,240,250,0.75)', shore: '#24506b', wave: 'rgba(255,255,255,0.9)', wavelet: 'rgba(36,80,107,0.55)',
  road: '#f2e3bf', roadLocal: '#ead9b2', roadEdge: '#6b4c2c', rail: '#4a3624',
  path: '#f5e8c9', pathEdge: '#7a5a36', seat: '#fbf3df', trail: '#8a5e36', creek: '#4f9fc8',
  letters: '#3d2b17', lettersHalo: 'rgba(250,242,220,0.85)', streetLetters: '#3d2b17',
  broadleaf: ['#5a9238', '#64a040', '#4c8433', '#72a648', '#7fae50', '#56893c', '#6b9a3e'], pine: ['#2f6a3c', '#3a7743', '#29603a', '#437a48'],
  autumn: ['#c9a13e', '#cf8a3c', '#b8612f'], trunk: '#6a4a2c', crownShade: 'rgba(25,55,30,0.32)', crownLight: 'rgba(255,248,200,0.38)',
  oakTrack: '#c99a63', oakInfield: '#8fc65a', railWhite: '#fffaf0',
};

// Dusk for the dark theme: the day painting graded cool, then lamps, lit windows and the tower's beacon on top.
export const NIGHT = {
  grade: '#4f5b88', lamp: 'rgba(255,196,110,', window: 'rgba(255,214,140,', beacon: 'rgba(255,90,60,',
  letters: '#f0e6c8', lettersHalo: 'rgba(30,36,60,0.75)', streetLetters: '#f0e6c8',
};

export const FONTS = { hand: '"Kalam", "Segoe Print", cursive', title: '"Rye", Georgia, serif' };
