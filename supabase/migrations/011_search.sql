-- Semantic search. Run in Supabase SQL Editor after 010.
-- voyage-3.5-lite produces 1024-dim vectors (our original table assumed 1536).

drop index if exists embeddings_vector_idx;
alter table embeddings drop column if exists embedding;
alter table embeddings add column embedding vector(1024);
alter table embeddings add column deal_id uuid references deals(id);
create index embeddings_vector_idx on embeddings
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Similarity search returning chunks with their meeting context
create or replace function search_transcripts(
  query_embedding vector(1024),
  match_count int default 12
)
returns table (
  interaction_id uuid,
  deal_id uuid,
  chunk_text text,
  similarity float
)
language sql stable as $$
  select e.interaction_id, e.deal_id, e.chunk_text,
         1 - (e.embedding <=> query_embedding) as similarity
  from embeddings e
  order by e.embedding <=> query_embedding
  limit match_count;
$$;
