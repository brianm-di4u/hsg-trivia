// What each named opponent says (S4-01). Short lines in each character's voice, kept as data beside the names in game.js.
// Events: stamp (wins a district stamp), hard (right on a hard question), miss (wrong answer), summitMiss (falls at the Tower),
// win (conquers the Tower), lose (another traveler does). Fictional characters; nothing here states a fact about the real town.
export const AI_LINES = {
  'Doc Vapor': {
    stamp: ['A fine stamp. Doctor’s orders!', 'Stamped! Now where are my spectacles?', 'Well, steam my spectacles. A stamp!'],
    hard: ['A tough one! Lucky guess, perhaps.', 'Even a doctor gets one right now and then.', 'I knew that! I think I knew that.'],
    miss: ['Ah. A small setback. Fresh air will fix it.', 'My mistake. Pass me a towel.', 'Oh dear. I may need a long soak.'],
    summitMiss: ['The mountain wins today. Back to the trailhead!', 'Too steep for an old doctor.', 'I will climb again after tea.'],
    win: ['Why, I have won! Somebody write that down.', 'Splendid! The cure was trivia all along.', 'The Tower at last! Call it a miracle.'],
    lose: ['Well played, friend. I will take a bath instead.', 'Congratulations! The steam was with you.', 'A fine climb. I will put the kettle on.'],
  },
  'Miss Promenade': {
    stamp: ['Another stamp for the passport. How charming.', 'A stamp, darling. Do keep up.', 'Lovely. The passport blushes.'],
    hard: ['A hard one, and not a hair out of place.', 'Quite elementary, really.', 'One does read.'],
    miss: ['How unfortunate. I blame the steam.', 'A momentary lapse. Do not stare.', 'Pardon me, I was admiring the view.'],
    summitMiss: ['Too windy up there for my hat.', 'I shall descend with dignity.', 'The Tower can wait. I shall stroll.'],
    win: ['The Tower is mine. Do clap.', 'A promenade, and a victory!', 'How very gratifying.'],
    lose: ['My congratulations, truly. Tea?', 'Well done. I curtsy to the winner.', 'A lovely climb. I shall applaud from here.'],
  },
  'The Professor': {
    stamp: ['Predictable. Stamp acquired.', 'One stamp, as calculated.', 'The data are on my side.'],
    hard: ['Hard, you say? I call it Tuesday.', 'As expected, on all counts.', 'A fair question and a faster answer.'],
    miss: ['A statistical anomaly.', 'That answer was out of character.', 'I shall consult my notes.'],
    summitMiss: ['A footnote, nothing more. I shall return.', 'The summit has requested a rematch.', 'An error. I will not repeat it.'],
    win: ['The conclusion was never in doubt.', 'Quod erat demonstrandum, at the Tower.', 'Quite so. Next question?'],
    lose: ['Your methods were sound. I concede.', 'A worthy result. I will review the tape.', 'I stand corrected, and slightly impressed.'],
  },
  'Ticket Taker': {
    stamp: ['Stamped and punched. Next!', 'One stamp, no extra charge.', 'Ticket punched, stamp earned.'],
    hard: ['Hard question, easy fare.', 'That one cost me nothing.', 'Right on schedule.'],
    miss: ['Wrong platform. I will catch the next.', 'A missed connection.', 'Hold my ticket. I will be back.'],
    summitMiss: ['That was not the last stop. Back we go.', 'All aboard for the trailhead.', 'Delayed, not cancelled.'],
    win: ['End of the line, and I am on top!', 'All tickets punched. I win!', 'Everybody off at the Tower.'],
    lose: ['Fine ride, friend. You earned it.', 'Your ticket, champion.', 'Well done. Mind the step.'],
  },
  'Trail Boss': {
    stamp: ['Another stamp in the saddlebag.', 'That is one more notch.', 'Stamp is in. Keep moving.'],
    hard: ['Tough trail. Rode it anyway.', 'Hard? Barely a bump.', 'Easy as a downhill trot.'],
    miss: ['Lost the trail on that one.', 'Hmph. Wrong fork.', 'Mud on my boots. Moving on.'],
    summitMiss: ['Mountain is stubborn. So am I.', 'Back down the spur, then.', 'Rest the horses. We climb again.'],
    win: ['Top of the mountain. Told you.', 'That is a summit, pardner.', 'Trail is done, and I am on top.'],
    lose: ['Good riding. The Tower is yours.', 'You earned that, friend.', 'Fair and square. Shake on it.'],
  },
  'Lady Tufa': {
    stamp: ['Settled like stone. One more stamp.', 'The springs favor me.', 'Warm water, steady hand.'],
    hard: ['Deep waters, calm answer.', 'I let the question run clear.', 'A hard stone, easily turned.'],
    miss: ['Even still water ripples.', 'A pebble in the stream.', 'The current moved me. Only for now.'],
    summitMiss: ['The mountain keeps its secrets today.', 'I will wait. Stone is patient.', 'Down we flow, and back up again.'],
    win: ['The Tower rises for me. Naturally.', 'Like the springs, I arrive.', 'I have crowned the valley.'],
    lose: ['The water carries you well, friend.', 'A deserved victory. I bow.', 'May the springs keep you warm.'],
  },
};
export const VOICE_EVENTS = ['stamp', 'hard', 'miss', 'summitMiss', 'win', 'lose'];
