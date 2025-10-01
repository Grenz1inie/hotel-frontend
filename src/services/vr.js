const DEFAULT_FALLBACK_SRC = 'https://pannellum.org/images/alma.jpg';

const VR_LIBRARY = [
  {
    id: 'ocean-suite',
    src: 'https://pannellum.org/images/bma-1.jpg',
    fallbackSrc: DEFAULT_FALLBACK_SRC,
    attribution: 'Pannellum 示例素材 (CC BY-SA 4.0)',
    sourceUrl: 'https://pannellum.org/',
    keywords: ['海景', 'ocean', '水景', '豪华', '行政', '套房']
  },
  {
    id: 'city-loft',
    src: 'https://pannellum.org/images/alma.jpg',
    fallbackSrc: DEFAULT_FALLBACK_SRC,
    attribution: 'Pannellum 示例素材 (CC BY-SA 4.0)',
    sourceUrl: 'https://pannellum.org/',
    keywords: ['城市', 'city', 'loft', '商务', '高级', '观景']
  },
  {
    id: 'mountain-retreat',
    src: 'https://pannellum.org/images/cerro-toco-0.jpg',
    fallbackSrc: DEFAULT_FALLBACK_SRC,
    attribution: 'Pannellum 示例素材 (CC BY-SA 4.0)',
    sourceUrl: 'https://pannellum.org/',
    keywords: ['山景', '山景房', '温泉', 'villa', '别墅', 'garden']
  },
  {
    id: 'default',
    title: '全球精品酒店样板间',
    src: DEFAULT_FALLBACK_SRC,
    fallbackSrc: DEFAULT_FALLBACK_SRC,
    attribution: 'Pannellum 示例素材 (CC BY-SA 4.0)',
    sourceUrl: 'https://pannellum.org/',
    keywords: []
  }
];

function normalize(value) {
  if (!value) return '';
  if (Array.isArray(value)) return value.join(' ');
  return String(value);
}

export function getVrEntry(room) {
  if (!room) return VR_LIBRARY.find((item) => item.id === 'default');
  const haystack = normalize(room.name) + ' ' + normalize(room.type) + ' ' + normalize(room.description) + ' ' + normalize(room.amenities);
  const lowered = haystack.toLowerCase();
  const matched = VR_LIBRARY.find((item) => item.keywords.some((keyword) => lowered.includes(keyword)));
  return matched || VR_LIBRARY.find((item) => item.id === 'default');
}

export function getVrLibrary() {
  return VR_LIBRARY.slice();
}

export const VR_DEFAULT_FALLBACK = DEFAULT_FALLBACK_SRC;
