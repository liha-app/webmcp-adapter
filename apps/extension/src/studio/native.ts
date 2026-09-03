import type { AdapterDefinition, Step, ToolDefinition, ToolInputSchema } from '@liha/adapter-schema';

/**
 * The other half of what Studio is for.
 *
 * An adapter drives a site from the outside because the site has not
 * implemented WebMCP. That is a stopgap by design, and the honest end state is
 * the site shipping the same tool itself. This turns a finished adapter into
 * the code that would do that — same name, same description, same input
 * schema, and the recorded workflow written out as the steps the developer has
 * to replace with a real call.
 *
 * So the artefact a recording produces is not only "make my site agent-ready
 * without touching it"; it is also "here is the WebMCP implementation to write
 * when you do touch it".
 *
 * What the snippet asserts about the API is measured, not assumed — see
 * docs/webmcp-api.md. Three of those facts are load-bearing here:
 *
 * - the browser does not validate input against `inputSchema`, so `execute`
 *   has to, and the generated code shows it being done
 * - throwing from `execute` loses the reason, so the snippet returns MCP error
 *   results instead
 * - there is no `unregisterTool`; an AbortSignal is the only way a tool goes
 *   away, so the registration takes one from the start
 */

/** Comment text cannot be allowed to end the comment it lives in. */
const safeComment = (text: string) => text.replace(/\*\//g, '*​/');

const quote = (value: string) => JSON.stringify(value);

/** Reads as `{{name}}` in a template, and as a value the agent supplied here. */
function describeTemplate(value: string): string {
  const parameter = value.match(/^\{\{([a-zA-Z0-9_]+)\}\}$/);
  return parameter ? `the ${parameter[1]} argument` : quote(value);
}

/** One recorded step, in a sentence — this is what the developer must replace. */
export function describeStep(step: Step): string {
  switch (step.type) {
    case 'click':
      return `click ${step.selector}`;
    case 'check':
      return `tick ${step.selector}`;
    case 'uncheck':
      return `untick ${step.selector}`;
    case 'submit':
      return `submit ${step.selector}`;
    case 'fill':
      return `fill ${step.selector} with ${describeTemplate(step.value)}`;
    case 'select':
      return `select ${describeTemplate(step.value)} in ${step.selector}`;
    case 'waitFor':
      return `wait for ${step.selector} to be ${step.state ?? 'present'}`;
    case 'assertVisible':
      return `expect ${step.selector} to be visible`;
    case 'assertText':
      return `expect ${step.selector} to contain ${describeTemplate(step.contains)}`;
    case 'readText':
      return `read the text of ${step.selector} as ${step.as}`;
    case 'readAttribute':
      return `read the ${step.attribute} attribute of ${step.selector} as ${step.as}`;
    case 'readList':
      return `read every ${step.selector} as ${step.as}`;
    case 'navigate':
      return `navigate to ${describeTemplate(step.path)}`;
  }
}

/** The bindings a tool produces, which become its structured result. */
export function outputBindings(tool: ToolDefinition): string[] {
  const names: string[] = [];
  for (const step of tool.steps) {
    if ('as' in step && !names.includes(step.as)) names.push(step.as);
  }
  return names;
}

/**
 * Input checks, generated from the schema the tool already declares.
 *
 * Chrome hands `execute` whatever the agent sent, `required` included or not,
 * so a tool that trusts its input is a tool that will one day be called with
 * `{}`.
 */
/*
 * A property name is JSON, and JavaScript identifiers are not.
 *
 * `default`, `class`, `1name` and `a-b` are all valid keys in an inputSchema
 * and none of them can be a `const`. This produced code that would not parse,
 * from a Studio button whose whole promise is that the output runs.
 */
const RESERVED = new Set(
  ('await break case catch class const continue debugger default delete do else enum export extends false finally ' +
   'for function if implements import in instanceof interface let new null package private protected public return ' +
   'static super switch this throw true try typeof var void while with yield arguments eval input')
    .split(' '),
);

export function localName(key: string, taken: Set<string>): string {
  let base = key.replace(/[^A-Za-z0-9_$]/g, '_');
  if (!/^[A-Za-z_$]/.test(base)) base = `_${base}`;
  if (RESERVED.has(base)) base = `${base}_`;
  let name = base;
  let n = 2;
  while (taken.has(name)) name = `${base}${n++}`;
  taken.add(name);
  return name;
}

function validationLines(schema: ToolInputSchema): string[] {
  const required = new Set(schema.required ?? []);
  const lines: string[] = [];
  const taken = new Set<string>();
  for (const [key, property] of Object.entries(schema.properties)) {
    const name = localName(key, taken);
    const read = `const ${name} = input?.[${quote(key)}];`;
    // Required lists the property, not the local we renamed it to.
    const isRequired = required.has(key);
    const expected =
      property.type === 'integer'
        ? `typeof ${name} !== 'number' || !Number.isInteger(${name})`
        : `typeof ${name} !== ${quote(property.type)}`;

    lines.push(read);
    if (isRequired) {
      lines.push(`if (${expected}) return failed(${quote(`${key} is required and must be a ${property.type}`)});`);
      if (property.type === 'string') {
        lines.push(`if (${name}.trim() === '') return failed(${quote(`${key} must not be empty`)});`);
      }
    } else {
      lines.push(
        `if (${name} !== undefined && (${expected})) return failed(${quote(`${key} must be a ${property.type}`)});`,
      );
    }
    if (property.enum) {
      const options = JSON.stringify(property.enum);
      const guard = isRequired ? '' : `${name} !== undefined && `;
      lines.push(
        `if (${guard}!${options}.includes(${name})) return failed(${quote(`${key} must be one of: ${property.enum.join(', ')}`)});`,
      );
    }
  }
  return lines;
}

const indent = (lines: string[], by: string) => lines.map((line) => (line ? `${by}${line}` : '')).join('\n');

function toolSource(tool: ToolDefinition): string {
  const bindings = outputBindings(tool);
  const workflow = tool.steps.map((step, index) => `         *   ${index + 1}. ${safeComment(describeStep(step))}`);
  const structured = bindings.length
    ? `\n        //     structuredContent: { ${bindings.map((name) => `${name}: /* ... */ null`).join(', ')} },`
    : '';

  return `  await document.modelContext.registerTool(
    {
      name: ${quote(tool.name)},${tool.title ? `\n      title: ${quote(tool.title)},` : ''}
      description: ${quote(tool.description)},
      inputSchema: ${JSON.stringify(tool.inputSchema, null, 2).split('\n').join('\n      ')},
      async execute(input) {
        // Chrome does not check input against inputSchema — it passes on whatever
        // the agent sent, so these checks are the tool's own responsibility.
${indent(validationLines(tool.inputSchema), '        ')}

        /*
         * The adapter reached this capability by driving the page:
         *
${workflow.join('\n')}
         *
         * Reproducing those steps is not the goal. They are what driving the UI
         * from outside costs; from in here, call what the UI itself calls.
         */
        // TODO: do the work, then return the result. On success it should read:
        //   return {
        //     content: [{ type: 'text', text: ${quote(`${tool.name} completed`)} }],${structured}
        //   };
        return failed(${quote(`${tool.name} is not implemented yet`)});
      },
    },
    { signal: registration.signal },
  );`;
}

/**
 * A complete, pasteable file: everything the site needs to register these tools
 * itself, with no adapter and no extension involved.
 */
export function nativeWebMcpSource(adapter: AdapterDefinition): string {
  const capabilities = [...new Set(adapter.tools.map((tool) => tool.capability))];
  return `/*
 * Native WebMCP for ${safeComment(adapter.name)}
 *
 * Generated by Liha Adapter Studio from the adapter ${safeComment(adapter.id)} v${safeComment(adapter.version)},
 * which drives ${adapter.origins.map(safeComment).join(', ')} from outside the page.
 *
 * This is the same capability, written the way the site would ship it. Once
 * this runs on your own pages the adapter is no longer needed: the tools below
 * are registered by you, agents discover them the same way, and nothing has to
 * inject anything into your document.
 *
 * Needs Chrome with chrome://flags/#enable-webmcp-testing enabled, and a secure
 * context: document.modelContext is undefined on an insecure origin. localhost
 * counts as secure, so http://localhost is fine and http://staging.internal is not.
 *
 * Declared capability: ${capabilities.join(', ')}.
 */

/*
 * Tools go away by AbortSignal and by nothing else — there is no
 * unregisterTool. Abort this to remove every tool registered with it.
 */
const registration = new AbortController();

/*
 * Errors are returned, not thrown. A thrown error reaches the agent as
 * "UnknownError: Tool was executed but the invocation failed", which tells it
 * nothing it can act on; an MCP error result carries the reason.
 */
const failed = (reason) => ({ content: [{ type: 'text', text: reason }], isError: true });

export async function registerWebMcpTools() {
  // Everything here is additive. A browser without WebMCP must get exactly the
  // page it gets today, so this returns rather than throwing.
  if (!document.modelContext) return false;

${adapter.tools.map(toolSource).join('\n\n')}

  return true;
}

registerWebMcpTools().catch((error) => {
  console.error('[webmcp] tools were not registered', error);
});
`;
}
