/**
 * A small hand-written shot list in the format Claude produces, used for the Remotion
 * Studio preview, render tests and as a known-good example. Three shots: a saver walking
 * under the sun, a jar filling with coins, a payoff burst.
 */
export const DEMO_STICK_SHOTS = String.raw`
const SAVER = { cols: PAL.blue, hat: 'none' };
function coin(ctx, x, y, r) { circle(ctx, x, y, r); fillStroke(ctx, '#ffd23a', r * .16); circle(ctx, x, y, r * .62); fillStroke(ctx, null, r * .08); }
function jar(ctx, x, y, w, h, fill) {
  rrect(ctx, x - w / 2, y - h, w, h, 34); fillStroke(ctx, 'rgba(210,240,255,.55)', 8);
  ctx.save(); rrect(ctx, x - w / 2, y - h, w, h, 34); ctx.clip();
  const fh = h * clamp(fill);
  ctx.fillStyle = '#f2c230'; ctx.fillRect(x - w / 2, y - fh, w, fh);
  for (let i = 0; i < 18 * fill; i++) { circle(ctx, x - w / 2 + 30 + (i * 53) % (w - 60), y - 20 - Math.floor(i / 4) * 34, 22); fillStroke(ctx, '#ffd84a', 4); }
  ctx.restore();
  rrect(ctx, x - w / 2 - 12, y - h - 30, w + 24, 40, 14); fillStroke(ctx, '#9a5a2a', 7);
}
SHOTS.push({ start: 0, end: DURATION * 0.38, tr: 'whip', draw(ctx, lt, t) {
  const hh = handheld(t, 3);
  const cam = { x: 540 + hh[0], y: 900 + hh[1], z: 1 + lt * .03, r: 0 };
  applyCam(ctx, cam, .1); drawSky(ctx, '#3ea6ee', '#c9ecfb');
  applyCam(ctx, cam, .12); drawSun(ctx, 860, 300, 90, t, 1);
  applyCam(ctx, cam, .2); drawCloud(ctx, 220 + t * 8, 380, 110, 1); drawCloud(ctx, 860 + t * 5, 560, 80, 2);
  applyCam(ctx, cam, 1);
  ctx.fillStyle = '#7cc46a'; ctx.fillRect(-400, 1180, 1900, 1400);
  line(ctx, -400, 1180, 1500, 1180, 8);
  const x = lerp(180, 760, inv(0, 3, lt));
  drawStick(ctx, C(SAVER, { x, y: 1240, s: 420, legs: walkLegs(t), arms: walkArms(t), face: { eyes: 'normal', mouth: 'smile', look: [.4, 0] } }));
  const k = kf(lt, [[.6, 0], [1, 1, backOut]]);
  coin(ctx, x + 120, 900 - Math.sin(t * 5) * 14, 46 * k);
} });
SHOTS.push({ start: DURATION * 0.38, end: DURATION * 0.75, tr: 'whip', draw(ctx, lt, t) {
  ctx.fillStyle = '#ffe9b8'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e9c98f'; ctx.fillRect(0, 1240, W, 700); line(ctx, 0, 1240, W, 1240, 8);
  const fill = easeOut(inv(0, 2.6, lt));
  jar(ctx, 540, 1220, 420, 560, fill);
  for (let i = 0; i < 4; i++) { const p = ((lt * 1.2 + i * .25) % 1); coin(ctx, 540 + (i - 1.5) * 60, lerp(300, 700, easeIn(p)), 36); }
  drawStick(ctx, C(SAVER, { x: 200, y: 1300, s: 380, arms: { L: [.3, -.1], R: [2.3, .4] }, face: { eyes: 'wide', mouth: 'o', look: [.8, -.2] } }));
} });
SHOTS.push({ start: DURATION * 0.75, end: DURATION, tr: 'cut', draw(ctx, lt, t) {
  ctx.fillStyle = '#ffd23a'; ctx.fillRect(0, 0, W, H);
  const k = kf(lt, [[0, 0], [.35, 1, backOut]]);
  burst(ctx, 540, 820, 380 * k, 14, '#fff3c2');
  text(ctx, '1 825 €', 540, 820, 150 * k, '#fff', INK, 16);
  drawStick(ctx, C(SAVER, { x: 540, y: 1300, s: 460, bob: Math.sin(t * 8) * .01, arms: POSE.handsUp.arms, face: { eyes: 'happy', mouth: 'grin' } }));
} });
`;
