import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Bot, Newspaper, Search } from 'lucide-react';
import { apiData, apiPage, type Article, type Row } from '../shared/api';
import { date, fixed, safeUrl, signed, text } from '../shared/format';
import { useLiveQuotes } from '../shared/live';
import { Note, Pagination, QueryState, securityLink } from '../shared/ui';

type ArticleDetail = Article & { author?: string | null; crawledAt?: string | null; contentTruncated?: boolean; companies?: { companyId: string; companyName: string; symbol: string; exchange: string; matchMethod: string; associationType: string }[]; companyLinksTruncated?: boolean };

export function NewsPage({ symbol, exchange }: { symbol?: string; exchange?: string }) {
  const [page, setPage] = useState(0);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const query = useQuery({ queryKey: ['news', symbol, exchange, search, from, to, page], staleTime: 600_000, queryFn: ({ signal }) => apiPage<Article>('news', [], { symbol, exchange: symbol ? exchange : undefined, search: search || undefined, from: from || undefined, to: to || undefined, page, size: 12 }, signal) });
  return <section className="panel"><div className="panel-heading"><div><h2>{symbol ? 'Tin liên quan ' + symbol : 'Tin tức thị trường'}</h2><span className="muted">{query.data ? `${query.data.total} bài · ` : ''}Thông tin doanh nghiệp từ các nguồn đã thu thập</span></div>
    <form className="toolbar" onSubmit={event => { event.preventDefault(); setSearch(input.trim()); setPage(0); }}>
      <label className="search"><Search size={16} /><input aria-label="Tìm trong tin" value={input} onChange={e => setInput(e.target.value)} placeholder="Tìm tiêu đề…" /></label>
      <input type="date" aria-label="Từ ngày" value={from} onChange={e => { setFrom(e.target.value); setPage(0); }} />
      <input type="date" aria-label="Đến ngày" value={to} onChange={e => { setTo(e.target.value); setPage(0); }} />
      <button type="submit"><Newspaper size={14} />Lọc</button>
    </form></div>
    <QueryState loading={query.isPending} error={query.error} empty={!query.data?.items.length} retry={query.refetch}><div className="news-grid">{query.data?.items.map(article => <article className="news-card" key={article.id}><div className="news-meta"><span>{article.sourceName}</span><time>{date(article.publishedAt)}</time></div><h3><a href={'#/news/' + encodeURIComponent(article.id)}>{article.title}</a></h3>{article.sapo && <p>{article.sapo}</p>}<div className="news-bottom"><span>{article.hasContent ? 'Đã có nội dung' : 'Bài viết chỉ có liên kết'}</span><a href={'#/news/' + encodeURIComponent(article.id)} aria-label={'Đọc ' + article.title}><ArrowUpRight size={18} /></a></div></article>)}</div></QueryState>
    {query.data && <Pagination page={page} total={query.data.total} hasNext={query.data.hasNext} onChange={setPage} />}
    <Note>Lọc ngày theo ngày đăng (giờ Việt Nam); bài chưa rõ ngày đăng chỉ xuất hiện khi không lọc ngày.</Note>
  </section>;
}

function NewsAnalysis({ id }: { id: string }) {
  const query = useQuery({ queryKey: ['news-analysis', id], staleTime: 900_000, queryFn: ({ signal }) => apiData<Row[]>('newsAnalysis', [id], {}, signal) });
  return <section className="panel"><div className="panel-heading"><div><h2><Bot size={16} />Phân tích AI của bài</h2><span className="muted">Chỉ kết quả đã qua kiểm định và còn khớp nội dung nguồn</span></div></div>
    <QueryState loading={query.isPending} error={query.error} retry={query.refetch}>{query.data?.data.length ? <div className="analysis-list">{query.data.data.map((row, i) => <article key={text(row.id, String(i))}><dl className="stats">{Object.entries(row).filter(([, v]) => v !== null && typeof v !== 'object').map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{text(typeof v === 'boolean' ? String(v) : v)}</dd></div>)}</dl>{Object.entries(row).filter(([, v]) => v !== null && typeof v === 'object').map(([k, v]) => <details key={k}><summary>{k}</summary><pre>{JSON.stringify(v, null, 2).slice(0, 4000)}</pre></details>)}</article>)}</div> : <div className="state"><strong>Chưa có phân tích được công bố cho bài này</strong><span>Trang không tự gọi mô hình để tạo phân tích.</span></div>}</QueryState>
  </section>;
}

export function ArticlePage({ id }: { id: string }) {
  const query = useQuery({ queryKey: ['article', id], staleTime: 1_800_000, queryFn: ({ signal }) => apiData<ArticleDetail>('article', [id], {}, signal) });
  const article = query.data?.data;
  const url = safeUrl(article?.url);
  const companies = article?.companies || [];
  const quotes = useLiveQuotes(companies.map(c => c.symbol));
  return <div className="article-layout">
    <section className="panel article"><a className="back-link" href="#/news">← Tin tức</a><QueryState loading={query.isPending} error={query.error} retry={query.refetch}><p className="eyebrow">{article?.sourceName} · {date(article?.publishedAt)}{article?.author ? ' · ' + article.author : ''}</p><h1>{article?.title}</h1>{article?.sapo && <p className="article-lead">{article.sapo}</p>}<div className="article-body">{article?.contentText || 'Nguồn hiện chỉ có liên kết bài viết. Bạn có thể đọc nội dung tại trang gốc.'}</div>{article?.contentTruncated && <p className="inline-alert">Nội dung dài đã được rút gọn, đọc bản đầy đủ tại nguồn.</p>}{url && <a className="button" href={url} target="_blank" rel="noopener noreferrer">Đọc tại nguồn <ArrowUpRight size={15} /></a>}</QueryState></section>
    <aside>
      <section className="panel"><div className="panel-heading"><h2>Mã liên quan</h2></div>{companies.length ? <ul className="plain-list">{companies.map(c => { const q = quotes.data?.[c.symbol]; const tone = q?.change == null ? '' : q.change > 0 ? 'positive' : q.change < 0 ? 'negative' : 'reference'; return <li key={c.companyId + c.symbol}><a href={securityLink(c.symbol, c.exchange)}><strong>{c.symbol}</strong> · {c.exchange} <span className={tone}>{fixed(q?.price)} {signed(q?.changePercent, 2, '%')}</span></a><small>{c.companyName} · liên kết {c.associationType === 'SOURCE_JOB' ? 'theo nguồn thu thập' : c.matchMethod}</small></li>; })}</ul> : <div className="state"><strong>Chưa liên kết doanh nghiệp</strong></div>}</section>
      <NewsAnalysis id={id} />
    </aside>
  </div>;
}
