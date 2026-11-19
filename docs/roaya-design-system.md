# Roaya design in Roaya Connect

Based on the supplied **Roaya IT Design System, version 1.0** (`Roaya Design System 2.md`).

The supplied **Roaya AWS Landing 1.html** is the visual reference for refinements: navy-to-teal gradients, navy/purple hero at the 55% midpoint, 56px hero grid, teal and purple radial lighting, 82% white navigation with 20px blur, 70% white cards with subtle teal borders, and layered card hover shadows. The source HTML remains outside the application. Its marketing content and scripts are not imported.

The exact navy, teal and purple ramps are in `src/app/roaya.css`. Shared semantic tokens are mapped in `globals.css`, including slate dark-mode values. Inter and Tajawal are self-hosted through Next's font loader; Tajawal is selected for RTL documents. Existing Lucide icons are retained.

Workspace adaptation: compact page headings and controls keep the dashboard usable, rather than applying marketing hero sizes to every card. Navigation and cards use medium glass over a tinted page wash. Modals use strong glass; menus retain opaque backgrounds for legibility. Cards use 16px radii, controls 12px and larger panels 24px. Primary buttons use the supplied 90-degree gradient with a dark scrim to keep white labels readable at the teal end. Status colours retain their semantic meaning.

The login page uses the deep navy hero treatment, a pill label and teal-to-purple accent text. Interactive cards use the reference's 6px lift, glow and icon motion; non-interactive records remain still. Icon tiles use the navy-to-teal gradient and 14px corners. Reduced-motion and increased-contrast preferences are respected. Core navigation uses logical borders and active indicators for RTL. This styles the current English application; it does not add a translated Arabic interface or language switcher.

The supplied transparent Roaya PNG is stored unchanged at public/branding/roaya-logo.png. Sidebar and sign-in branding use this artwork with a separate Connect label. Compact navigation and the tab icon reveal the cloud portion of the same image; no logo artwork has been redrawn. No fabricated metrics, marketing claims, stock images or company policies were introduced.

Authorisation, data loading, task workflows and public-sharing behaviour are unchanged. No SQL migration is required for these visual changes.
