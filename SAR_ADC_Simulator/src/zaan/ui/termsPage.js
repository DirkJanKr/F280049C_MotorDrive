import { GLOSSARY } from '../glossary.js';
import { esc } from './fmt.js';

export function termsPage() {
  const rows = Object.entries(GLOSSARY).map(([k, v]) => `<div class="term"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('');
  return `<section class="intro"><h1>Terms</h1><p class="lede">One line per converter or IC term used in this workbench.</p></section><div class="card terms">${rows}</div>`;
}
