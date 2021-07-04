const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const Voting = artifacts.require('Voting');

contract("Voting", accounts => {
    const owner = accounts[0];
    const recipient = accounts[1];
    const recipient2 = accounts[2];

    beforeEach(async function () {
        this.votingInstance = await Voting.new({from: owner});
    });

    describe('RegisteringVoters', function() {

        it('adds addresses to whitelist', async function () {
            await this.votingInstance.addToWhitelist(accounts[1], {from: owner});
            let addresses = await this.votingInstance.getAddresses();
            let voter = await this.votingInstance.getVoter(accounts[1]);
    
            expect(addresses[0]).to.equal(accounts[1]);
            expect(voter.isRegistered).to.equal(true);
        });
    
        it('reverts whitelisting if not the owner', async function () {
            await expectRevert(this.votingInstance.addToWhitelist(accounts[1], {from: accounts[1]}), 'Ownable: caller is not the owner');
        });
    
        it('reverts whitelisting if already registered', async function () {
            await this.votingInstance.addToWhitelist(accounts[1], {from: owner});
            await expectRevert(this.votingInstance.addToWhitelist(accounts[1], {from: owner}), 'Address already whitelisted');
        });
    
        it('reverts whitelisting if wrong workflow', async function () {
            await this.votingInstance.startProposalsRegistration();
            await expectRevert(this.votingInstance.addToWhitelist(accounts[1], {from: owner}), 'Worflow not respected');
        });
    
        it('sends an event after whitelisting', async function () {
            expectEvent(await this.votingInstance.addToWhitelist(accounts[1], {from: owner}), 'VoterRegistered', {voterAddress: accounts[1]});
        });  
    });

    describe('Update worflow', function() {

        it('changes worflow status', async function () {
            let workflow = await this.votingInstance.getWorkflow();
            expect(workflow).to.be.bignumber.equal(new BN(0));

            await this.votingInstance.startProposalsRegistration();
            let workflow2 = await this.votingInstance.getWorkflow();
            expect(workflow2).to.be.bignumber.equal(new BN(1));
        });

        it('sends an event after changing worflow', async function () {
            expectEvent(await this.votingInstance.startProposalsRegistration(), 'WorkflowStatusChange', {previousStatus: new BN(0), newStatus: new BN(1)});
        });
    });

    describe('Register proposals', function() {

        it('registers proposals', async function () {
            await this.votingInstance.addToWhitelist(accounts[1], {from: owner});
            await this.votingInstance.startProposalsRegistration();
            await this.votingInstance.registerProposal('more coffee breaks', {from: accounts[1]});
            let proposals = await this.votingInstance.getProposals();

            expect(proposals[0].description).to.equal('more coffee breaks');
        });

        it('reverts if caller is not whitelisted', async function () {
            await this.votingInstance.startProposalsRegistration();
            await expectRevert(this.votingInstance.registerProposal('more coffee breaks', {from: accounts[1]}), 'Address not whitelisted');
        });

        it('reverts if not the correct workflow', async function () {
            await this.votingInstance.addToWhitelist(accounts[1], {from: owner});
            await expectRevert(this.votingInstance.registerProposal('more coffee breaks', {from: accounts[1]}), 'Worflow not respected');
        });

        it('ends registering proposals', async function () {
            await this.votingInstance.startProposalsRegistration();
            await this.votingInstance.endProposalsRegistration();
            let workflow = await this.votingInstance.getWorkflow();

            expect(workflow).to.be.bignumber.equal(new BN(2));
        });

        it('sends an event when starting and ending proposals registration', async function () {
            expectEvent(await this.votingInstance.startProposalsRegistration(), 'ProposalsRegistrationStarted');
            expectEvent(await this.votingInstance.endProposalsRegistration(), 'ProposalsRegistrationEnded');
        });

        it('sends an event when a proposal is registered', async function () {
            await this.votingInstance.addToWhitelist(accounts[1], {from: owner});
            await this.votingInstance.startProposalsRegistration();

            expectEvent(await this.votingInstance.registerProposal('more coffee breaks', {from: accounts[1]}), 'ProposalRegistered', {proposalId: new BN(0)});
        });
    });

    describe('Register votes', function() {

        beforeEach(async function () {
            await this.votingInstance.addToWhitelist(accounts[1], {from: owner});
            await this.votingInstance.startProposalsRegistration();
            await this.votingInstance.registerProposal('more coffee breaks', {from: accounts[1]});
            await this.votingInstance.registerProposal('longer nap times', {from: accounts[1]});
            await this.votingInstance.endProposalsRegistration();
        });

        it('registers votes', async function () {
            await this.votingInstance.startVotingSession();
            let voterBefore = await this.votingInstance.getVoter(accounts[1]);
            let proposalsBefore = await this.votingInstance.getProposals();

            await this.votingInstance.registerVote(new BN(1), {from: accounts[1]});

            let voter = await this.votingInstance.getVoter(accounts[1]);
            let proposals = await this.votingInstance.getProposals();

            expect(voterBefore.hasVoted).to.equal(false);
            expect(voter.hasVoted).to.equal(true);
            expect(voterBefore.votedProposalId).to.be.bignumber.equal(new BN(0));
            expect(voter.votedProposalId).to.be.bignumber.equal(new BN(1));
            expect(proposalsBefore[1].voteCount).to.be.bignumber.equal(new BN(0));
            expect(proposals[1].voteCount).to.be.bignumber.equal(new BN(1));
        });

        it('updates winningProposalId', async function () {
            await this.votingInstance.startVotingSession();
            let winnerBefore = await this.votingInstance.getWinningProposalId();

            await this.votingInstance.registerVote(new BN(1), {from: accounts[1]});
            let winnerAfter = await this.votingInstance.getWinningProposalId();

            expect(winnerBefore).to.be.bignumber.equal(new BN(0));
            expect(winnerAfter).to.be.bignumber.equal(new BN(1));
        });

        it('reverts if not whitelisted', async function () {
            await this.votingInstance.startVotingSession();
            await expectRevert(this.votingInstance.registerVote(new BN(1), {from: owner}), 'Address not whitelisted');
        });

        it('reverts if not correct workflow', async function () {
            await expectRevert(this.votingInstance.registerVote(new BN(1), {from: accounts[1]}), 'Worflow not respected');
        });

        it('reverts if already voted', async function () {
            await this.votingInstance.startVotingSession();
            await this.votingInstance.registerVote(new BN(1), {from: accounts[1]});
            await expectRevert(this.votingInstance.registerVote(new BN(1), {from: accounts[1]}), 'Address has already voted');
        });

        it('sends an event when starting and ending votes registration', async function () {
            expectEvent(await this.votingInstance.startVotingSession(), 'VotingSessionStarted');
            expectEvent(await this.votingInstance.endVotingSession(), 'VotingSessionEnded');
        });

        it('sends an event when a vote is registered', async function () {
            await this.votingInstance.startVotingSession();
            expectEvent(await this.votingInstance.registerVote(new BN(1), {from: accounts[1]}), 'Voted', {voter: accounts[1], proposalId: new BN(1)});
        });
    });

    describe('Tally votes', function() {

        it('sends an event when started', async function () {
            await this.votingInstance.startProposalsRegistration();
            await this.votingInstance.endProposalsRegistration();
            await this.votingInstance.startVotingSession();
            await this.votingInstance.endVotingSession();
            expectEvent(await this.votingInstance.tallyVotes(), 'VotesTallied');
        });

        it('reverts if not correct workflow', async function () {
            await expectRevert(this.votingInstance.tallyVotes(), 'Worflow not respected');
        });
    });
});
