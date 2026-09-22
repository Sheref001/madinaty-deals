import { createHash } from 'node:crypto';
import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';
import { RequestError } from './request.js';

const cacheKey = (text, sourceLanguage, targetLanguage) => createHash('sha256').update(`${sourceLanguage}\0${targetLanguage}\0${text}`).digest('hex');

export function createTranslator({ prisma, config }) {
  const client = config.translation.enabled ? new TranslateClient({ region: config.translation.region }) : null;
  return {
    async translate({ text, sourceLanguage, targetLanguage }) {
      const key = cacheKey(text, sourceLanguage, targetLanguage);
      const cached = await prisma.translationCache.findUnique({ where: { cacheKey: key }, select: { translatedText: true } });
      if (cached) return { translation: cached.translatedText, cached: true, sourceLanguage, targetLanguage };
      if (!client) throw new RequestError(503, 'Translation is temporarily unavailable.');
      let translatedText;
      try {
        const result = await client.send(new TranslateTextCommand({ Text: text, SourceLanguageCode: sourceLanguage, TargetLanguageCode: targetLanguage }));
        translatedText = typeof result.TranslatedText === 'string' ? result.TranslatedText.trim() : '';
      } catch {
        throw new RequestError(502, 'Translation is temporarily unavailable.');
      }
      if (!translatedText) throw new RequestError(502, 'Translation is temporarily unavailable.');
      try {
        await prisma.translationCache.create({ data: { cacheKey: key, sourceLanguage, targetLanguage, sourceText: text, translatedText } });
      } catch (error) {
        if (error?.code !== 'P2002') throw error;
      }
      return { translation: translatedText, cached: false, sourceLanguage, targetLanguage };
    },
  };
}
