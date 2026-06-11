// Script to generate PWA icons from the large logo
const fs = require('fs');
const path = require('path');

// We'll create properly sized PNG icons using a simple approach
// Since we can't use sharp in this environment, let's create an SVG wrapper

const sizes = [192, 512];

sizes.forEach(size => {
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ff6b6b"/>
      <stop offset="30%" style="stop-color:#ee5a24"/>
      <stop offset="70%" style="stop-color:#a855f7"/>
      <stop offset="100%" style="stop-color:#4ecdc4"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#bg)"/>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" 
        font-family="Outfit, sans-serif" font-weight="800" font-size="${size * 0.35}"
        fill="white">KC</text>
  <text x="50%" y="78%" dominant-baseline="middle" text-anchor="middle"
        font-family="Outfit, sans-serif" font-weight="700" font-size="${size * 0.09}"
        fill="rgba(255,255,255,0.8)">CONNECT</text>
</svg>`;

    fs.writeFileSync(path.join(__dirname, '..', 'public', `icon-${size}.svg`), svgContent);
    console.log(`Created public/icon-${size}.svg`);
});

console.log('Done! Created SVG icons for PWA.');