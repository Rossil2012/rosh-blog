import { defineDocumentType, makeSource } from 'contentlayer2/source-files';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import rehypeExternalLinks from 'rehype-external-links';
import fs from 'fs';

export const Article = defineDocumentType(() => ({
  name: 'Article',
  filePathPattern: `./article/**/index.{md,mdx}`,
  contentType: 'mdx',
  fields: {
    title: { type: 'string', required: true },
    date: { type: 'date', required: true },
    description: { type: 'string', required: false },
    tags: { type: 'list', of: { type: 'string' }, required: false },
  },
  computedFields: {
    url: { type: 'string', resolve: (post) => `/articles/${post._raw.flattenedPath}` },
    rawContent: {
      type: 'string',
      resolve: (post) => fs.readFileSync(`content/${post._raw.sourceFilePath}`, 'utf-8'),
    },
  },
}));

export default makeSource({
  contentDirPath: 'content',
  documentTypes: [Article],
  mdx: {
    rehypePlugins: [
      rehypeSlug,
      [rehypePrettyCode, { theme: 'one-dark-pro' }],
      rehypeExternalLinks,
    ],
    remarkPlugins: [remarkGfm],
  },
});