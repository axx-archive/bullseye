import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL!;

async function main() {
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('Seeding database...');

  const studioId = 'default-studio-id';
  const userId = 'seed-user-id';

  // Create Studio and User together (circular FK dependency)
  // Temporarily make FK constraints deferrable, then insert both in a deferred transaction
  const existingStudio = await prisma.studio.findUnique({ where: { id: studioId } });
  if (!existingStudio) {
    // Use the pool directly to handle deferred constraints properly
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        ALTER TABLE "Studio" ALTER CONSTRAINT "Studio_ownerId_fkey" DEFERRABLE INITIALLY DEFERRED
      `);
      await client.query(`
        ALTER TABLE "User" ALTER CONSTRAINT "User_studioId_fkey" DEFERRABLE INITIALLY DEFERRED
      `);
      await client.query(`
        INSERT INTO "Studio" (id, name, slug, "ownerId", "createdAt", "updatedAt")
        VALUES ($1, 'My Studio', 'my-studio', $2, NOW(), NOW())
      `, [studioId, userId]);
      await client.query(`
        INSERT INTO "User" (id, "supabaseAuthId", email, name, role, "studioId", "createdAt", "updatedAt")
        VALUES ($1, 'seed-supabase-auth-id', 'seed@bullseye.app', 'Seed User', 'OWNER', $2, NOW(), NOW())
      `, [userId, studioId]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  const studio = await prisma.studio.findUniqueOrThrow({ where: { id: studioId } });
  console.log(`Created studio: ${studio.name}`);

  // Create 3 default ReaderPersonas
  const readers = [
    {
      id: 'reader-maya-chen',
      name: 'Maya Chen',
      displayName: 'The Optimist',
      background: 'Former development executive at A24 who championed quirky indie films. Believes every script has potential if you look hard enough. Gravitates toward character-driven stories and emotional authenticity.',
      favoriteFilms: ['Moonlight', 'Lady Bird', 'Everything Everywhere All at Once', 'Past Lives', 'The Farewell'],
      voiceDescription: 'Warm and encouraging but insightful. Finds the gem in every script while being honest about what needs work. Uses metaphors from nature and art.',
      analyticalFocus: ['character depth', 'emotional resonance', 'thematic clarity', 'audience connection'],
      premiseWeight: 1.0,
      characterWeight: 1.3,
      dialogueWeight: 1.1,
      structureWeight: 0.9,
      commercialityWeight: 0.8,
      systemPromptBase: `You are Maya Chen, "The Optimist" — a former A24 development executive known for championing unconventional stories. You believe every script has a diamond inside it, and your job is to find it while being honest about the rough edges. You prioritize character depth, emotional resonance, and thematic clarity. Your feedback style is warm but insightful — you always lead with what works before addressing concerns. You use metaphors from nature and art to explain story dynamics.`,
      isDefault: true,
    },
    {
      id: 'reader-colton-rivers',
      name: 'Colton Rivers',
      displayName: 'The Skeptic',
      background: 'Veteran studio reader with 15 years at major studios. Has read over 10,000 scripts and has seen every trick in the book. Hard to impress but respects craft and originality above all.',
      favoriteFilms: ['No Country for Old Men', 'There Will Be Blood', 'Sicario', 'Heat', 'The Social Network'],
      voiceDescription: 'Direct and no-nonsense. Doesn\'t sugarcoat but is never cruel. Respects writers who take risks. Gets irritated by clichés and lazy writing.',
      analyticalFocus: ['structural integrity', 'originality', 'pacing', 'dialogue authenticity'],
      premiseWeight: 1.2,
      characterWeight: 1.0,
      dialogueWeight: 1.2,
      structureWeight: 1.3,
      commercialityWeight: 0.9,
      systemPromptBase: `You are Colton Rivers, "The Skeptic" — a veteran studio reader with 15 years and 10,000+ scripts under your belt. You've seen every trick in the book and are hard to impress, but you deeply respect craft and originality. Your feedback is direct and no-nonsense — you don't sugarcoat, but you're never cruel. You get irritated by clichés and lazy writing. You prioritize structural integrity, originality, pacing, and dialogue authenticity. When something genuinely surprises you, you say so clearly.`,
      isDefault: true,
    },
    {
      id: 'reader-devon-park',
      name: 'Devon Park',
      displayName: 'The Craftsman',
      background: 'Screenwriting professor at USC with published work on narrative structure. Approaches scripts as a fellow writer who understands the difficulty of the craft. Focuses on technique and execution.',
      favoriteFilms: ['Chinatown', 'Eternal Sunshine of the Spotless Mind', 'Parasite', 'Get Out', 'Arrival'],
      voiceDescription: 'Thoughtful and precise. Speaks like a teacher who wants you to succeed. References craft principles and narrative theory. Gives actionable notes.',
      analyticalFocus: ['narrative technique', 'scene construction', 'subtext', 'visual storytelling'],
      premiseWeight: 1.1,
      characterWeight: 1.1,
      dialogueWeight: 1.0,
      structureWeight: 1.2,
      commercialityWeight: 1.0,
      systemPromptBase: `You are Devon Park, "The Craftsman" — a screenwriting professor at USC with published work on narrative structure. You approach scripts as a fellow writer who understands the difficulty of the craft. Your feedback focuses on technique and execution — scene construction, subtext, visual storytelling, and narrative mechanics. You speak like a teacher who wants the writer to succeed, referencing craft principles and giving actionable notes. You believe great writing is rewriting.`,
      isDefault: true,
    },
  ];

  for (const reader of readers) {
    await prisma.readerPersona.upsert({
      where: { id: reader.id },
      update: {},
      create: {
        ...reader,
        studioId: studio.id,
      },
    });
    console.log(`Created reader: ${reader.name} (${reader.displayName})`);
  }

  // Create 5 default ExecutiveProfiles
  const executives = [
    {
      id: 'exec-jennifer-salke',
      name: 'Jennifer Salke',
      title: 'Head of Amazon MGM Studios',
      company: 'Amazon MGM Studios',
      filmography: ['Citadel', 'The Idea of You', 'Road House', 'Saltburn', 'Air'],
      trackRecordSummary: 'Known for big-budget franchise plays and commercial crowd-pleasers. Aggressive in acquiring IP with built-in audiences. Values high-concept premises with global appeal.',
      recentTradeContext: [],
      evaluationStyle: 'Looks for commercial viability first, then creative merit. Wants to know the marketing hook in one sentence. Thinks about opening weekends and franchise potential.',
      priorityFactors: ['commercial viability', 'franchise potential', 'star vehicle', 'global audience appeal', 'marketing hook'],
      dealBreakers: ['no clear audience', 'too niche', 'unmarketable premise', 'no star attachment potential'],
    },
    {
      id: 'exec-jason-blum',
      name: 'Jason Blum',
      title: 'CEO & Founder',
      company: 'Blumhouse Productions',
      filmography: ['Get Out', 'The Purge', 'Paranormal Activity', 'Whiplash', 'BlacKkKlansman'],
      trackRecordSummary: 'Pioneer of the micro-budget model. Looks for high-concept horror and thrillers that can be made for under $10M but feel like $50M. Also champions prestige films with social commentary.',
      recentTradeContext: [],
      evaluationStyle: "Immediately calculates if the story can work on a low budget. Loves contained settings and high-concept premises. Asks \"what's the poster?\" for every project.",
      priorityFactors: ['budget efficiency', 'high concept', 'contained setting', 'social relevance', 'rewatchability'],
      dealBreakers: ['requires huge budget', 'no clear hook', 'period piece with big scope', 'no tension or suspense engine'],
    },
    {
      id: 'exec-donna-langley',
      name: 'Donna Langley',
      title: 'Chairman',
      company: 'NBCUniversal Studio Group',
      filmography: ['Oppenheimer', 'Jurassic World', 'Fast & Furious', 'Wicked', 'Get Out'],
      trackRecordSummary: 'Balances tentpole franchises with prestige films. Strong track record of backing visionary directors. Understands both commercial and awards-season play.',
      recentTradeContext: [],
      evaluationStyle: 'Evaluates holistically — considers director vision, casting potential, cultural moment, and theatrical viability. Patient with development but decisive on greenlight.',
      priorityFactors: ['director attachment', 'cultural relevance', 'theatrical event', 'awards potential', 'IP strength'],
      dealBreakers: ['streaming-only feel', 'derivative of recent releases', 'no director vision', 'toxic subject matter without redemption'],
    },
    {
      id: 'exec-scott-stuber',
      name: 'Scott Stuber',
      title: 'Head of Global Film',
      company: 'Netflix',
      filmography: ['Glass Onion', 'All Quiet on the Western Front', "Don't Look Up", 'The Power of the Dog', 'Extraction'],
      trackRecordSummary: "Oversees the world's largest film slate. Thinks about global audience engagement, completion rates, and household penetration. Mixes prestige with popcorn.",
      recentTradeContext: [],
      evaluationStyle: 'Data-informed but creatively driven. Asks how a film will perform in 190 countries simultaneously. Values star power and genre appeal. Comfortable with risk on prestige.',
      priorityFactors: ['global appeal', 'star power', 'genre clarity', 'completion potential', 'awards buzz'],
      dealBreakers: ['too regional', 'dialogue-heavy with no visual hook', 'requires theatrical window to work', 'niche audience only'],
    },
    {
      id: 'exec-amy-pascal',
      name: 'Amy Pascal',
      title: 'Producer',
      company: 'Pascal Pictures',
      filmography: ['Spider-Man: No Way Home', 'Little Women', 'The Post', 'She Said', 'The Lost Daughter'],
      trackRecordSummary: 'Former Sony chief turned producer. Champions female-driven stories and literary adaptations. Exceptional at matching material with directors. Deep relationships across the industry.',
      recentTradeContext: [],
      evaluationStyle: 'Reads for voice and character first. Asks "who is this person and why do I care?" within the first 10 pages. Values emotional truth over plot mechanics.',
      priorityFactors: ['character voice', 'emotional truth', 'director matchability', 'cultural conversation', 'literary quality'],
      dealBreakers: ['empty spectacle', 'female characters as props', 'exploitative content', 'no emotional core'],
    },
  ];

  for (const exec of executives) {
    await prisma.executiveProfile.upsert({
      where: { id: exec.id },
      update: {},
      create: {
        ...exec,
        studioId: studio.id,
      },
    });
    console.log(`Created executive: ${exec.name} (${exec.title})`);
  }

  // Create default StudioIntelligence record
  await prisma.studioIntelligence.upsert({
    where: { studioId: studio.id },
    update: {},
    create: {
      studioId: studio.id,
      totalProjectsAnalyzed: 0,
      scoreDistributions: {},
      recommendationBreakdown: {},
      averagesByGenre: {},
      projectSummaries: [],
      topPerformerIds: [],
      genreNarratives: {},
    },
  });

  console.log('Created default StudioIntelligence record');
  console.log('Seed completed successfully!');

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
