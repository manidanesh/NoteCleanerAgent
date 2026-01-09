import { Note } from '../../models/Note';
import { UtilityScore } from '../../models/UtilityScore';
import { UserPreferences } from '../UtilityScorerAgent';

// Shared interfaces for results
export interface TFIDFResult {
    score: number;
    keywordScores: Map<string, number>;
    importantTerms: string[];
}

export interface BehavioralResult {
    score: number;
    accessFrequency: number;
    recencyScore: number;
    sharingScore: number;
}

export interface SemanticResult {
    score: number;
    contentQuality: number;
    relevanceScore: number;
    uniquenessScore: number;
}

export interface RuleBasedResult {
    score: number;
    ageScore: number;
    lengthScore: number;
    checklistScore: number;
    completenessScore: number;
}

export class ScoringAlgorithms {
    // --- TF-IDF Logic ---
    static tokenize(text: string): string[] {
        return text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2);
    }

    static countWords(words: string[]): Map<string, number> {
        const counts = new Map<string, number>();
        for (const word of words) {
            counts.set(word, (counts.get(word) || 0) + 1);
        }
        return counts;
    }

    static getKeywordImportance(word: string): number {
        const importantPatterns = [
            /^(meeting|project|task|todo|important|urgent|deadline)/,
            /^(idea|concept|strategy|plan|goal)/,
            /^(contact|phone|email|address)/,
            /^(date|time|schedule|appointment)/
        ];

        for (const pattern of importantPatterns) {
            if (pattern.test(word)) return 1.5;
        }
        return 1.0;
    }

    static calculateTFIDFScore(
        note: Note,
        documentFrequencies: Map<string, number>,
        totalDocuments: number
    ): TFIDFResult {
        const text = `${note.title} ${note.content}`.toLowerCase();
        const words = this.tokenize(text);

        if (words.length === 0) {
            return {
                score: 20,
                keywordScores: new Map(),
                importantTerms: []
            };
        }

        const wordCounts = this.countWords(words);
        const keywordScores = new Map<string, number>();
        let totalScore = 0;

        const totalDocs = totalDocuments || 1000;

        for (const [word, count] of wordCounts) {
            const tf = count / words.length;
            const df = documentFrequencies.get(word) || Math.max(1, totalDocs * 0.1);
            const idf = Math.log(totalDocs / df);
            const tfidf = tf * idf;

            const importance = this.getKeywordImportance(word);
            const weightedScore = tfidf * importance;

            keywordScores.set(word, weightedScore);
            totalScore += weightedScore;
        }

        const normalizedScore = Math.min(100, Math.max(0, totalScore * 20));

        const importantTerms = Array.from(keywordScores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word]) => word);

        return {
            score: normalizedScore,
            keywordScores,
            importantTerms
        };
    }

    // --- Behavioral Logic ---
    static calculateBehavioralScore(note: Note, preferences: UserPreferences): BehavioralResult {
        const now = new Date();
        const daysSinceCreated = (now.getTime() - new Date(note.createdDate).getTime()) / (1000 * 60 * 60 * 24);
        const daysSinceModified = (now.getTime() - new Date(note.modifiedDate).getTime()) / (1000 * 60 * 60 * 24);

        // access frequency
        const accessFrequency = Math.min(100, (note.metadata.accessCount / Math.max(1, daysSinceCreated)) * 10);

        // recent score
        const recencyScore = Math.max(0, 100 - (daysSinceModified * 2));

        // sharing score
        const sharingScore = note.metadata.isShared ? Math.min(100, note.metadata.shareCount * 20) : 0;

        const behavioralScore = (
            accessFrequency * preferences.accessFrequencyImportance +
            recencyScore * preferences.recencyImportance +
            sharingScore * 0.3
        ) / (preferences.accessFrequencyImportance + preferences.recencyImportance + 0.3);

        return {
            score: Math.min(100, behavioralScore),
            accessFrequency,
            recencyScore,
            sharingScore
        };
    }

    // --- Semantic Logic ---
    static calculateSemanticScore(note: Note): SemanticResult {
        const contentQuality = this.assessContentQuality(note);
        const relevanceScore = this.assessRelevance(note);
        const uniquenessScore = this.assessUniqueness(note);

        const semanticScore = (contentQuality + relevanceScore + uniquenessScore) / 3;

        return {
            score: semanticScore,
            contentQuality,
            relevanceScore,
            uniquenessScore
        };
    }

    static assessContentQuality(note: Note): number {
        let score = 50;
        if (note.title && note.title.length > 5 && !note.title.match(/^(note|untitled|new)/i)) score += 15;
        if (note.content.includes('\n')) score += 10;
        if (note.checklists.length > 0) score += 10;
        if (note.attachments.length > 0) score += 10;
        if (note.metadata.wordCount > 50) score += 10;
        if (note.metadata.wordCount > 200) score += 5;
        return Math.min(100, score);
    }

    static assessRelevance(note: Note): number {
        let score = 60;
        const hasDateReferences = /\b(today|tomorrow|yesterday|next week|deadline)\b/i.test(note.content);
        if (hasDateReferences) score += 20;
        const hasActionItems = /\b(todo|task|action|follow up|remember)\b/i.test(note.content);
        if (hasActionItems) score += 15;
        return Math.min(100, score);
    }

    static assessUniqueness(note: Note): number {
        let score = 70;
        if (note.metadata.wordCount < 10) score -= 30;
        else if (note.metadata.wordCount < 25) score -= 15;
        if (note.title.match(/^(note|untitled|new|test)/i)) score -= 20;
        return Math.max(0, score);
    }

    // --- Rule Based Logic ---
    static calculateRuleBasedScore(note: Note, preferences: UserPreferences): RuleBasedResult {
        const now = new Date();
        const daysSinceModified = Math.max(0, (now.getTime() - new Date(note.modifiedDate).getTime()) / (1000 * 60 * 60 * 24));

        const ageScore = Math.max(0, 100 - (daysSinceModified * 1.5));
        const lengthScore = this.scoreLengthPreference(note.metadata.wordCount, preferences.contentLengthPreference);
        const checklistScore = this.scoreChecklistCompletion(note.checklists);
        const completenessScore = this.scoreCompleteness(note);

        const ruleBasedScore = (ageScore + lengthScore + checklistScore + completenessScore) / 4;

        return {
            score: ruleBasedScore,
            ageScore,
            lengthScore,
            checklistScore,
            completenessScore
        };
    }

    static scoreLengthPreference(wordCount: number, preference: number): number {
        if (wordCount >= 25 && wordCount <= 200) {
            return 100 * preference + (1 - preference) * 70;
        } else if (wordCount < 25) {
            return Math.max(20, (wordCount / 25) * 70);
        } else {
            return Math.max(50, 100 - ((wordCount - 200) / 50));
        }
    }

    static scoreChecklistCompletion(checklists: any[]): number {
        if (!checklists || checklists.length === 0) return 70;
        const totalItems = checklists.length;
        const completedItems = checklists.filter(item => item.completed).length;
        const completionRate = completedItems / totalItems;
        if (completionRate === 0) return 80;
        if (completionRate === 1) return 60;
        return 90;
    }

    static scoreCompleteness(note: Note): number {
        let score = 50;
        if (note.title && note.title.length > 5) score += 20;
        if (note.metadata.wordCount > 20) score += 20;
        if (note.content.includes('\n') || (note.checklists && note.checklists.length > 0)) score += 10;
        return Math.min(100, score);
    }
}
