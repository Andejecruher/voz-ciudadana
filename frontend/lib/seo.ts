import type { Metadata } from 'next';

const FALLBACK_BASE_URL = 'https://voz-ciudadana-rust.vercel.app';

export const siteConfig = {
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? FALLBACK_BASE_URL,
  siteName: 'Voz Ciudadana',
  defaultTitle: 'Voz Ciudadana — Cintalapa tiene voz de mujer',
  defaultDescription:
    'Candidata de Cintalapa de Figueroa, Chiapas. Agua, seguridad y campo próspero para cada familia. Nací aquí, crecí aquí y juntas haremos historia.',
  locale: 'es_MX',
  ogImage: {
    path: '/images/og-image-optimice.jpg',
    width: 1200,
    height: 630,
    alt: 'Voz Ciudadana — Cintalapa de Figueroa, Chiapas',
  },
} as const;

export type OgImageInput = {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
};

export type PageMetadataInput = {
  title: string;
  description: string;
  path?: string;
  openGraphTitle?: string;
  image?: OgImageInput;
};

const isAbsoluteUrl = (url: string) => url.startsWith('http://') || url.startsWith('https://');

export const getAbsoluteUrl = (path = '/') => new URL(path, siteConfig.baseUrl).toString();

const resolveImage = (image: OgImageInput): Required<OgImageInput> => {
  const resolvedUrl = isAbsoluteUrl(image.url) ? image.url : getAbsoluteUrl(image.url);

  return {
    url: resolvedUrl,
    width: image.width ?? siteConfig.ogImage.width,
    height: image.height ?? siteConfig.ogImage.height,
    alt: image.alt ?? siteConfig.ogImage.alt,
  };
};

const defaultOgImage = resolveImage({
  url: siteConfig.ogImage.path,
  width: siteConfig.ogImage.width,
  height: siteConfig.ogImage.height,
  alt: siteConfig.ogImage.alt,
});

export const buildOpenGraph = ({
  title,
  description,
  path = '/',
  image,
}: {
  title: string;
  description: string;
  path?: string;
  image?: OgImageInput;
}): NonNullable<Metadata['openGraph']> => {
  const canonicalUrl = getAbsoluteUrl(path);
  const resolvedImage = image ? resolveImage(image) : defaultOgImage;

  return {
    type: 'website',
    locale: siteConfig.locale,
    url: canonicalUrl,
    siteName: siteConfig.siteName,
    title,
    description,
    images: [
      {
        url: resolvedImage.url,
        width: resolvedImage.width,
        height: resolvedImage.height,
        alt: resolvedImage.alt,
      },
    ],
  };
};

export const buildTwitter = ({
  title,
  description,
  image,
}: {
  title: string;
  description: string;
  image?: OgImageInput;
}): NonNullable<Metadata['twitter']> => {
  const resolvedImage = image ? resolveImage(image) : defaultOgImage;

  return {
    card: 'summary_large_image',
    title,
    description,
    images: [resolvedImage.url],
  };
};

export const createPageMetadata = ({
  title,
  description,
  path = '/',
  openGraphTitle,
  image,
}: PageMetadataInput): Metadata => {
  const ogTitle = openGraphTitle ?? title;
  const canonicalUrl = getAbsoluteUrl(path);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: buildOpenGraph({
      title: ogTitle,
      description,
      path,
      image,
    }),
    twitter: buildTwitter({
      title: ogTitle,
      description,
      image,
    }),
  };
};
