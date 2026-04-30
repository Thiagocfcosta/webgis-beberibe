export const createPattern = (type, color) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const size = 16;
    canvas.width = size;
    canvas.height = size;

    // Fundo transparente
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, size, size);
    
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.5;

    if (type === 'diagonal') {
      // Hachura Diagonal Seamless
      ctx.beginPath();
      ctx.moveTo(0, size);
      ctx.lineTo(size, 0);
      ctx.moveTo(-size/2, size/2);
      ctx.lineTo(size/2, -size/2);
      ctx.moveTo(size/2, size*1.5);
      ctx.lineTo(size*1.5, size/2);
      ctx.stroke();
    } else if (type === 'cross') {
      // Hachura Cruzada Seamless
      ctx.beginPath();
      ctx.moveTo(0, size);
      ctx.lineTo(size, 0);
      ctx.moveTo(-size/2, size/2);
      ctx.lineTo(size/2, -size/2);
      ctx.moveTo(size/2, size*1.5);
      ctx.lineTo(size*1.5, size/2);
      // Oposto
      ctx.moveTo(0, 0);
      ctx.lineTo(size, size);
      ctx.moveTo(-size/2, size/2);
      ctx.lineTo(size/2, size*1.5);
      ctx.moveTo(size/2, -size/2);
      ctx.lineTo(size*1.5, size/2);
      ctx.stroke();
    } else if (type === 'dots') {
      // Pontilhado Seamless
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Sólido
      ctx.fillRect(0, 0, size, size);
    }

    const img = new Image();
    img.onload = () => resolve(img);
    img.src = canvas.toDataURL();
  });
};
