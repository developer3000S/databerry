import { Datastore, MessageFrom } from '@prisma/client';
import { AIMessage, HumanMessage } from 'langchain/schema';

import {
  AppDocument,
  ChunkMetadataRetrieved,
  Source,
} from '@app/types/document';
import { ChatRequest } from '@app/types/dtos';

import chat, { ChatProps } from '../chatv2';
import retrieval from '../retrieval';

export type ChatRetrievalChainProps = Omit<ChatProps, 'prompt'> & {
  datastore?: Datastore;
  topK?: number;
  filters?: ChatRequest['filters'];
  includeSources?: boolean;
  retrievalSearch?: string;
  getPrompt: (chunks: AppDocument<ChunkMetadataRetrieved>[]) => string;
};

/*
    - retrieval
    - chat request
    - source generation
    - output
  */
const chatRetrieval = async ({
  temperature,
  topK,
  stream,
  history,
  filters,
  modelName,
  datastore,
  includeSources,
  retrievalSearch,
  initialMessages,
  getPrompt,
}: ChatRetrievalChainProps) => {
  const SIMILARITY_THRESHOLD = 0.78;

  const results = (
    retrievalSearch
      ? await retrieval({
          datastore,
          filters,
          topK: topK || 5,
          query: retrievalSearch,
        })
      : []
  ).filter((each) => each.metadata.score! > SIMILARITY_THRESHOLD);

  const prompt = getPrompt(results);

  // Generate answer
  const { answer } = await chat({
    modelName,
    prompt,
    temperature: temperature || 0,
    stream,
    history,
    initialMessages,
  });

  // Generate sources
  const sources: Source[] = [];

  if (includeSources && results?.length > 0) {
    results
      .map((each) => ({
        chunk_id: each.metadata.chunk_id,
        datasource_id: each.metadata.datasource_id!,
        datasource_name: each.metadata.datasource_name!,
        datasource_type: each.metadata.datasource_type!,
        source_url: each.metadata.source_url!,
        mime_type: each.metadata.mime_type!,
        page_number: each.metadata.page_number!,
        total_pages: each.metadata.total_pages!,
        score: each.metadata.score!,
      }))
      .forEach((each) => {
        if (!sources.find((one) => one.datasource_id === each.datasource_id)) {
          sources.push(each);
        }
      });
  }

  return {
    answer,
    sources,
  };
};

export default chatRetrieval;
