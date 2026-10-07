import Link from "next/link";

type BlogPost = {
  id:       string;
  title:    string;
  slug:     string;
  excerpt:  string | null;
  imageUrl: string | null;
};

interface Props {
  posts: BlogPost[];
}

export function BlogSection({ posts }: Props) {
  if (posts.length === 0) return null;

  return (
    <section className="bg-white py-20">
      <div className="max-w-6xl mx-auto px-6">

        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-xs font-semibold tracking-[0.25em] text-gray-400 uppercase mb-4">
            Health Delivered
          </p>
          <h2
            className="text-5xl font-normal text-gray-900"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Latest Blog
          </h2>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`}
              className="group bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">

              {/* Image */}
              <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
                {post.imageUrl ? (
                  <img
                    src={post.imageUrl}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Text */}
              <div className="p-5">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide leading-snug mb-3 line-clamp-2">
                  {post.title}
                </h3>
                {post.excerpt && (
                  <p className="text-xs text-gray-500 leading-relaxed line-clamp-4 mb-4">
                    {post.excerpt}
                  </p>
                )}
                <span className="text-xs font-semibold text-[#1b3b6f] group-hover:underline">
                  Read more →
                </span>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </section>
  );
}
