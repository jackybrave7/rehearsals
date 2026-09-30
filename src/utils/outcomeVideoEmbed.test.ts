import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseEmbeddableVideoLink } from '../../shared/outcomeVideoEmbed';

describe('parseEmbeddableVideoLink', () => {
  it('parses YouTube watch and youtu.be', () => {
    const watch = parseEmbeddableVideoLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.equal(watch?.provider, 'youtube');
    assert.equal(watch?.canonicalUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.match(watch?.embedUrl ?? '', /embed\/dQw4w9WgXcQ/);

    const short = parseEmbeddableVideoLink('https://youtu.be/dQw4w9WgXcQ');
    assert.equal(short?.canonicalUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('parses Rutube', () => {
    const parsed = parseEmbeddableVideoLink('https://rutube.ru/video/abc123def456/');
    assert.equal(parsed?.provider, 'rutube');
    assert.match(parsed?.embedUrl ?? '', /play\/embed\/abc123def456/);
  });

  it('parses Vimeo', () => {
    const parsed = parseEmbeddableVideoLink('https://vimeo.com/123456789');
    assert.equal(parsed?.provider, 'vimeo');
    assert.equal(parsed?.embedUrl, 'https://player.vimeo.com/video/123456789');
  });

  it('rejects unknown hosts', () => {
    assert.equal(parseEmbeddableVideoLink('https://example.com/video/1'), null);
  });
});
