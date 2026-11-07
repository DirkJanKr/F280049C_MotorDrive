import { GLOSSARY } from '../glossary.js';
import { esc } from './fmt.js';

export function termsView() {
  const rows = Object.entries(GLOSSARY).map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join('');
  return `<div class="card"><h2>Terms</h2><div class="scroll"><table><tbody>${rows}</tbody></table></div></div>`;
}
