import Phaser from 'phaser';

export function AddBackground(scene: Phaser.Scene): Phaser.GameObjects.Image {
  const width = scene.scale.width;
  const height = scene.scale.height;
  const bg = scene.add.image(width / 2, height / 2, 'background');
  const scaleX = width / bg.width;
  const scaleY = height / bg.height;
  const scale = Math.max(scaleX, scaleY); 
  
  bg.setScale(scale);

  scene.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
    bg.setPosition(gameSize.width / 2, gameSize.height / 2);
    const sx = gameSize.width / bg.width;
    const sy = gameSize.height / bg.height;
    bg.setScale(Math.max(sx, sy));
  });

  return bg;
}