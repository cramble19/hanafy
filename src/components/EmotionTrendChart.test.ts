import { describe, expect, it } from 'vitest'
import { emotionCurveRuns } from './EmotionTrendChart'

describe('emotion curve gaps', () => {
  it('splits daily missing records without splitting available averages', () => {
    expect(emotionCurveRuns([4, null, 5], 44).map(run => run.length)).toEqual([1, 1])
    expect(emotionCurveRuns([4, 4, 4.5], 44).map(run => run.length)).toEqual([3])
    expect(emotionCurveRuns([null, null], 44)).toEqual([])
  })
})
