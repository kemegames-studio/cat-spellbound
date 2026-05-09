import Phaser from 'phaser';

/** Draw a filled star polygon on a Graphics object */
export function fillStar(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  points: number,
  outerR: number,
  innerR: number,
  rotation: number = 0,
): void {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2 + rotation;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
  }
  g.fillPoints(pts, true);
}
