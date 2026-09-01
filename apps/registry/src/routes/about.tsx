export function About() {
  return (
    <article className="prose">
      <h1>How it works</h1>
      <p>
        WebMCP lets a website hand an agent real tools instead of making it guess at the DOM. Today a site becomes
        agent-ready only when its own developers ship <code>document.modelContext.registerTool()</code>. Liha removes
        that dependency: an adapter adds those tools from the outside.
      </p>

      <h2>An adapter is data, not code</h2>
      <p>
        Every adapter is JSON. Its steps come from a closed vocabulary — click, fill, select, check, waitFor, readText
        and a handful more. There is no <code>eval</code> step, no expression language, no remote script, and no way to
        express one. That is what makes a community registry of adapters something you can reason about instead of a
        malware distribution channel.
      </p>

      <h2>Scoped, classified, and confirmable</h2>
      <ul>
        <li>
          <strong>Origin scoped.</strong> An adapter declares exact origins and runs nowhere else.
        </li>
        <li>
          <strong>Capability classified.</strong> Each tool is READ, INTERACT, WRITE or DESTRUCTIVE, shown before you
          install.
        </li>
        <li>
          <strong>Destructive means confirmed.</strong> Deleting always asks; WRITE can be set to ask too.
        </li>
        <li>
          <strong>Fails closed.</strong> If a selector does not match exactly one element, the call fails rather than
          guessing which button to press.
        </li>
        <li>
          <strong>No credentials.</strong> Adapters cannot type into or read from password and payment fields, at all.
        </li>
      </ul>

      <h2>This page is not using an adapter</h2>
      <p>
        The registry implements WebMCP natively — it is what a site looks like when its developers do the work. Ask your
        agent to <em>“find an adapter for a CRM with write access”</em> and it will call this page's own{' '}
        <code>search_adapters</code> tool. The demo apps in this project deliberately implement nothing, and get their
        tools from adapters instead.
      </p>

      <h2>Trying it</h2>
      <ol>
        <li>
          Enable <code>chrome://flags/#enable-webmcp-testing</code> and restart Chrome.
        </li>
        <li>
          Load the unpacked extension from <code>apps/extension/dist</code>.
        </li>
        <li>Install an adapter from this registry, then open the site it targets and reload.</li>
      </ol>
    </article>
  );
}
