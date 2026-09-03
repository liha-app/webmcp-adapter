import { BrandMark } from '@liha/brand';
import { siteUrl, type SiteId } from '@liha/config';

/**
 * The strip above every demo site, and the way back to the portal.
 *
 * The three demos are meant to read as ordinary third-party websites — that is
 * the whole argument — so the way back cannot live inside their chrome without
 * spoiling it. It lives above it instead, in a bar that plainly belongs to
 * something else: one dark strip, the same on all three, whatever palette the
 * site underneath is using. A visitor always knows what they are looking at and
 * is one click from the catalogue, and the storefront below is still a
 * storefront.
 *
 * The portal's origin is resolved rather than hard-coded, so a demo served from
 * localhost links to the local portal and the deployed one links to the
 * deployed portal. @liha/config owns that mapping for the whole project.
 */
export function DemoBar({ site }: { site: Exclude<SiteId, 'registry'> }) {
  const origin = typeof location === 'undefined' ? undefined : location.origin;
  const portal = siteUrl('registry', origin);
  return (
    <div className="demobar" data-testid="demo-bar">
      <div className="demobar__inner">
        <a className="demobar__back" href={portal} data-action="back-to-portal">
          <span className="demobar__arrow" aria-hidden="true">
            ‹
          </span>
          <BrandMark className="demobar__mark" size={18} />
          <span>
            Back to <strong>Liha</strong> WebMCP Adapter
          </span>
        </a>
        <p className="demobar__note">
          A demo site. It implements no WebMCP — every tool on it comes from an adapter.
        </p>
        <a className="demobar__adapter" href={`${portal}/adapters/${site}`} data-action="view-adapter">
          This site’s adapter ›
        </a>
      </div>
    </div>
  );
}
