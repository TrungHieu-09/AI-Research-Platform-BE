import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import type { RequestUser } from "@/lib/auth"
import type {
  CreateForumPostInput,
  CreateForumReplyInput,
  ForumModerationInput,
  SolveForumPostInput,
} from "@/lib/validation/forum"

type ForumListFilters = {
  search?: string
  status?: string
  visibility?: string
  subjectId?: string
  tag?: string
  mine?: boolean
  solved?: boolean
  sort?: string
}

const forumPostInclude = {
  author: { select: { id: true, name: true, email: true, avatarUrl: true } },
  subject: { select: { id: true, name: true, code: true } },
  tags: { select: { id: true, name: true } },
  _count: { select: { replies: true } },
} satisfies Prisma.ForumPostInclude

const forumPostDetailInclude = {
  ...forumPostInclude,
  solvedReply: {
    select: {
      id: true,
      postId: true,
      authorId: true,
      content: true,
      isHelpful: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  replies: {
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  },
} satisfies Prisma.ForumPostInclude

const publicApprovedPostWhere = {
  status: "APPROVED",
  visibility: "PUBLIC",
} satisfies Prisma.ForumPostWhereInput

function normalizeTags(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)))
}

function canViewPost(
  post: { authorId: string; status: string; visibility: string; deletedAt: Date | null },
  user?: RequestUser | null,
) {
  if (post.deletedAt) return false
  if (user?.role === "ADMIN") return true
  if (post.status === "APPROVED" && post.visibility === "PUBLIC") return true
  return !!user && post.authorId === user.id
}

function buildAccessibleWhere(user?: RequestUser | null): Prisma.ForumPostWhereInput {
  if (user?.role === "ADMIN") return {}
  if (!user) return publicApprovedPostWhere

  return {
    OR: [
      publicApprovedPostWhere,
      { authorId: user.id },
    ],
  }
}

function getOrderBy(sort?: string): Prisma.ForumPostOrderByWithRelationInput[] {
  if (sort === "most_discussed") return [{ replies: { _count: "desc" } }, { createdAt: "desc" }]
  if (sort === "most_viewed") return [{ viewCount: "desc" }, { createdAt: "desc" }]
  if (sort === "trending") return [{ viewCount: "desc" }, { replies: { _count: "desc" } }, { createdAt: "desc" }]
  return [{ createdAt: "desc" }]
}

export async function getForumPosts(
  user: RequestUser | null,
  page = 1,
  pageSize = 20,
  filters: ForumListFilters = {},
) {
  const skip = (page - 1) * pageSize
  const andFilters: Prisma.ForumPostWhereInput[] = [buildAccessibleWhere(user)]

  const where: Prisma.ForumPostWhereInput = {
    deletedAt: null,
    AND: andFilters,
  }

  if (filters.mine) {
    if (!user) return { items: [], total: 0, page, pageSize, totalPages: 0 }
    where.authorId = user.id
  }

  if (filters.status && ["PENDING", "APPROVED", "REJECTED"].includes(filters.status)) {
    where.status = filters.status as Prisma.ForumPostWhereInput["status"]
  }
  if (filters.visibility && ["PUBLIC", "PRIVATE"].includes(filters.visibility)) {
    where.visibility = filters.visibility as Prisma.ForumPostWhereInput["visibility"]
  }
  if (filters.subjectId) {
    where.subjectId = filters.subjectId
  }
  if (typeof filters.solved === "boolean") {
    where.isSolved = filters.solved
  }
  if (filters.tag) {
    where.tags = { some: { name: filters.tag.trim().toLowerCase() } }
  }
  if (filters.search) {
    andFilters.push({
      OR: [
        { title: { contains: filters.search, mode: "insensitive" } },
        { content: { contains: filters.search, mode: "insensitive" } },
      ],
    })
  }

  const [items, total] = await Promise.all([
    db.forumPost.findMany({
      where,
      orderBy: getOrderBy(filters.sort),
      skip,
      take: pageSize,
      include: forumPostInclude,
    }),
    db.forumPost.count({ where }),
  ])

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function createForumPost(authorId: string, input: CreateForumPostInput) {
  if (input.subjectId) {
    const subject = await db.subject.findUnique({ where: { id: input.subjectId } })
    if (!subject) throw new Error("Subject not found.")
  }

  return db.forumPost.create({
    data: {
      title: input.title,
      content: input.content,
      authorId,
      subjectId: input.subjectId ?? null,
      visibility: input.visibility,
      status: input.visibility === "PUBLIC" ? "PENDING" : "APPROVED",
      tags: {
        connectOrCreate: normalizeTags(input.tags).map((name) => ({
          where: { name },
          create: { name },
        })),
      },
    },
    include: forumPostInclude,
  })
}

export async function getForumPostById(id: string, user: RequestUser | null) {
  const post = await db.forumPost.findFirst({
    where: { id, deletedAt: null },
    include: forumPostDetailInclude,
  })

  if (!post) throw new Error("Forum post not found.")
  if (!canViewPost(post, user)) throw new Error("Forbidden: Access denied to this forum post.")

  return db.forumPost.update({
    where: { id },
    data: { viewCount: { increment: 1 } },
    include: forumPostDetailInclude,
  })
}

export async function createForumReply(
  postId: string,
  authorId: string,
  user: RequestUser,
  input: CreateForumReplyInput,
) {
  const post = await db.forumPost.findFirst({ where: { id: postId, deletedAt: null } })
  if (!post) throw new Error("Forum post not found.")
  if (!canViewPost(post, user)) throw new Error("Forbidden: Access denied to this forum post.")
  if (post.status !== "APPROVED" && post.authorId !== user.id && user.role !== "ADMIN") {
    throw new Error("Replies are only allowed on approved posts.")
  }

  return db.forumReply.create({
    data: {
      postId,
      authorId,
      content: input.content,
    },
    include: {
      author: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  })
}

export async function solveForumPost(postId: string, user: RequestUser, input: SolveForumPostInput) {
  const post = await db.forumPost.findFirst({ where: { id: postId, deletedAt: null } })
  if (!post) throw new Error("Forum post not found.")
  if (post.authorId !== user.id && user.role !== "ADMIN") throw new Error("Permission denied.")

  const reply = await db.forumReply.findFirst({
    where: { id: input.replyId, postId },
  })
  if (!reply) throw new Error("Reply not found for this post.")

  return db.forumPost.update({
    where: { id: postId },
    data: {
      isSolved: true,
      solvedReplyId: input.replyId,
    },
    include: forumPostDetailInclude,
  })
}

export async function deleteForumPost(postId: string, user: RequestUser) {
  const post = await db.forumPost.findFirst({ where: { id: postId, deletedAt: null } })
  if (!post) throw new Error("Forum post not found.")
  if (post.authorId !== user.id && user.role !== "ADMIN") throw new Error("Permission denied.")

  return db.forumPost.update({
    where: { id: postId },
    data: { deletedAt: new Date() },
  })
}

export async function getAdminForumPosts(
  page = 1,
  pageSize = 20,
  filters: { status?: string; search?: string } = {},
) {
  const skip = (page - 1) * pageSize
  const where: Prisma.ForumPostWhereInput = { deletedAt: null }

  if (filters.status && ["PENDING", "APPROVED", "REJECTED"].includes(filters.status)) {
    where.status = filters.status as Prisma.ForumPostWhereInput["status"]
  }
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { content: { contains: filters.search, mode: "insensitive" } },
      { author: { name: { contains: filters.search, mode: "insensitive" } } },
      { author: { email: { contains: filters.search, mode: "insensitive" } } },
    ]
  }

  const [items, total] = await Promise.all([
    db.forumPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: forumPostInclude,
    }),
    db.forumPost.count({ where }),
  ])

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function moderateForumPost(postId: string, input: ForumModerationInput) {
  const post = await db.forumPost.findFirst({ where: { id: postId, deletedAt: null } })
  if (!post) throw new Error("Forum post not found.")

  const updated = await db.forumPost.update({
    where: { id: postId },
    data: {
      status: input.decision,
      rejectionReason: input.decision === "REJECTED" ? input.rejectionReason! : null,
    },
    include: forumPostInclude,
  })

  if (input.decision === "REJECTED") {
    await db.notification.create({
      data: {
        userId: post.authorId,
        title: "Bài thảo luận bị từ chối",
        content: `Bài thảo luận "${post.title}" của bạn đã bị từ chối với lý do: ${input.rejectionReason}`,
      },
    })
  }

  return updated
}

export async function getForumTags() {
  const visiblePostWhere = { deletedAt: null, ...publicApprovedPostWhere }
  const tags = await db.tag.findMany({
    where: {
      forumPosts: {
        some: visiblePostWhere,
      },
    },
    select: {
      name: true,
      _count: { select: { forumPosts: { where: visiblePostWhere } } },
    },
    orderBy: {
      forumPosts: { _count: "desc" },
    },
    take: 30,
  })

  return {
    items: tags.map((tag) => ({
      name: tag.name,
      count: tag._count.forumPosts,
    })),
  }
}

export async function getForumStats() {
  const visiblePostWhere = { deletedAt: null, ...publicApprovedPostWhere }
  const [totalPosts, solvedPosts, unansweredPosts, activeUsers, totalReplies] = await Promise.all([
    db.forumPost.count({ where: visiblePostWhere }),
    db.forumPost.count({ where: { ...visiblePostWhere, isSolved: true } }),
    db.forumPost.count({ where: { ...visiblePostWhere, replies: { none: {} } } }),
    db.user.count({
      where: {
        OR: [
          { forumPosts: { some: visiblePostWhere } },
          { forumReplies: { some: { post: visiblePostWhere } } },
        ],
      },
    }),
    db.forumReply.count({ where: { post: visiblePostWhere } }),
  ])

  return {
    totalPosts,
    solvedPosts,
    unansweredPosts,
    activeUsers,
    totalReplies,
  }
}
