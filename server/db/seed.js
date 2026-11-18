// Demo data for local development only.
// Built from the sample listings the frontend originally shipped with.
// These people, reviews and ratings are fictional — never load them on the live site.
import { LISTINGS } from '../../src/data/listings.js'
import { LISTING_DETAILS } from '../../src/data/listingDetails.js'

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export const demoReviewer = {
    id: 'demo-reviewer',
    email: 'demo-reviewer@demo.rentaleze.invalid',
    firstName: 'Demo',
    lastName: 'Reviewer'
}

const ownersByName = new Map()
for (const l of LISTINGS) {
    if (!ownersByName.has(l.ownerName)) {
        const [firstName, lastInitial = ''] = l.ownerName.split(' ')
        ownersByName.set(l.ownerName, {
            id: `demo-owner-${slug(l.ownerName)}`,
            email: `demo-owner-${slug(l.ownerName)}@demo.rentaleze.invalid`,
            firstName,
            lastName: lastInitial.replace('.', ''),
            avatar: l.ownerAvatar,
            verified: l.verified
        })
    }
}

export const demoOwners = [...ownersByName.values()]

export const demoListings = LISTINGS.map(l => {
    const d = LISTING_DETAILS[l.id] || {}
    return {
        ...l,
        id: `demo-${l.id}`,
        ownerId: ownersByName.get(l.ownerName).id,
        description: d.description || '',
        instantBook: l.badges.includes('Instant Book'),
        condition: d.specs?.Condition || null,
        images: d.images || [l.image],
        includes: d.includes || [],
        specs: d.specs || {},
        rules: d.rules || [],
        ownerSince: d.ownerSince || null,
        ownerResponseRate: d.ownerResponseRate ?? null,
        ownerResponseTime: d.ownerResponseTime || null,
        ownerTotalReviews: d.ownerTotalReviews || 0,
        ownerBio: d.ownerBio || '',
        reviews: d.reviews || []
    }
})
