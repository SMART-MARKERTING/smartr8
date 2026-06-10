import { useEffect } from "react";

interface PageMetaProps {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  noIndex?: boolean;
}

type MetaEntry = { el: HTMLMetaElement; prev: string | null; created: boolean };
type LinkEntry = { el: HTMLLinkElement; prev: string | null; created: boolean };

function setMeta(nameOrProp: string, content: string, prop = false): MetaEntry {
  const attr = prop ? "property" : "name";
  let el = document.querySelector(`meta[${attr}="${nameOrProp}"]`) as HTMLMetaElement | null;
  const created = !el;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, nameOrProp);
    document.head.appendChild(el);
  }
  const prev = el.getAttribute("content");
  el.setAttribute("content", content);
  return { el, prev, created };
}

function setLink(rel: string, href: string): LinkEntry {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  const created = !el;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  const prev = el.getAttribute("href");
  el.setAttribute("href", href);
  return { el, prev, created };
}

export function PageMeta({ title, description, canonical, ogImage, noIndex }: PageMetaProps) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    const ogUrl = `https://smartr8.com${canonical}`;
    const image = ogImage ?? "https://smartr8.com/og-image-heloc.jpg";

    const metas: MetaEntry[] = [
      setMeta("description", description),
      setMeta("og:title", title, true),
      setMeta("og:description", description, true),
      setMeta("og:url", ogUrl, true),
      setMeta("og:image", image, true),
      setMeta("og:type", "website", true),
      setMeta("twitter:title", title),
      setMeta("twitter:description", description),
      setMeta("twitter:image", image),
    ];
    if (noIndex) metas.push(setMeta("robots", "noindex, nofollow"));

    const links: LinkEntry[] = [setLink("canonical", ogUrl)];

    return () => {
      document.title = prevTitle;
      metas.forEach(({ el, prev, created }) => {
        if (created) el.parentNode?.removeChild(el);
        else if (prev !== null) el.setAttribute("content", prev);
      });
      links.forEach(({ el, prev, created }) => {
        if (created) el.parentNode?.removeChild(el);
        else if (prev !== null) el.setAttribute("href", prev);
      });
    };
  }, []);
  return null;
}
