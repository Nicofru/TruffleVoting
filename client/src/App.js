import "./App.css";
import getWeb3 from "./getWeb3";
import React, { Component } from "react";
import VotingContract from "./contracts/Voting.json";
import { Button, Card, ListGroup, Table, Form } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css'

class App extends Component {
  state = {
    web3: null,
    accounts: null,
    contract: null,
    winningProposalId: null,
    workflow: 0,
    whitelist: [],
    proposals: [],
    formProposal: null,
    formAddress: null,
    formVote: null,
    owner: null,
    formError: null
  };

  componentDidMount = async () => {
    try {
      const web3 = await getWeb3();
      const accounts = await web3.eth.getAccounts();
      const networkId = await web3.eth.net.getId();
      const deployedNetwork = VotingContract.networks[networkId];

      const contract = new web3.eth.Contract(
        VotingContract.abi,
        deployedNetwork && deployedNetwork.address,
      );

      window.ethereum.on("accountsChanged", async () => {
        const accounts = await web3.eth.getAccounts();
        this.setState({accounts});
      });

      this.setState({ web3, accounts, contract }, this.runInit);
    } catch (error) {
      alert(`Failed to load web3, accounts, or contract. Check console for details.`);
      console.error(error);
    }
  };

  runInit = async() => {
    const { contract } = this.state;

    const whitelist = await contract.methods.getAddresses().call();
    const proposals = await contract.methods.getProposals().call();
    const workflow = await contract.methods.getWorkflow().call();
    const winningProposalId = await contract.methods.getWinningProposalId().call();
    const owner = await contract.methods.owner().call();

    this.setState({whitelist, workflow: parseInt(workflow), winningProposalId, owner, proposals });

    contract.events.VoterRegistered().on('data', (event) => this.handleEventVoterRegistered(event)).on('error', console.error);
    contract.events.ProposalRegistered().on('data', (event) => this.handleEventProposalRegistered(event)).on('error', console.error);
    contract.events.Voted().on('data', (event) => this.handleEventVoted(event)).on('error', console.error);
    contract.events.WorkflowStatusChange().on('data', (event) => this.handleEventWorkflowStatusChange(event)).on('error', console.error);
  };

  handleSubmitTallyVotes = async(event) => {
    event.preventDefault();
    const { accounts, contract } = this.state;
    const winningProposalId = await contract.methods.getWinningProposalId().call();

    this.setState({ winningProposalId });
    await contract.methods.tallyVotes().send({from: accounts[0]});
  }

  handleSubmitEndVotingSession = async(event) => {
    event.preventDefault();
    const { accounts, contract } = this.state;

    await contract.methods.endVotingSession().send({from: accounts[0]});
  }

  handleEventVoted = async (event) => {
    const { proposals } = this.state;
    const updatedProposals = proposals;
    updatedProposals[event.returnValues[1]].voteCount = parseInt(updatedProposals[event.returnValues[1]].voteCount) + 1;

    this.setState({ proposals: updatedProposals });
  }

  handleSubmitRegisterVote = async (event) => {
    event.preventDefault();
    const { accounts, contract } = this.state;
    const vote = parseInt(this.state.formVote);

    try {
      this.setState({ formError: null });
      await contract.methods.registerVote(vote).send({from: accounts[0]});
    } catch (error) {
      console.error(error.message);
      this.setState({ formError: error.message });
    }
  }

  handleSubmitStartVotingSession = async (event) => {
    event.preventDefault();
    const { accounts, contract } = this.state;

    await contract.methods.startVotingSession().send({from: accounts[0]});
  }

  handleSubmitEndProposalsRegistration = async(event) => {
    event.preventDefault();
    const { accounts, contract } = this.state;

    await contract.methods.endProposalsRegistration().send({from: accounts[0]});
  }

  handleEventProposalRegistered = async (event) => {
    const { contract } = this.state;
    const updatedProposals = await contract.methods.getProposals().call();
    this.setState({ proposals: updatedProposals });
  }

  handleSubmitRegisterProposal = async(event) => {
    event.preventDefault();
    const { accounts, contract } = this.state;
    const proposal = this.state.formProposal;

    await contract.methods.registerProposal(proposal).send({from: accounts[0]});
  }

  handleEventWorkflowStatusChange = async () => {
    const { workflow } = this.state;
    const newWorkflow = parseInt(workflow) + 1;
    this.setState({ workflow: parseInt(newWorkflow) });
  }

  handleSubmitStartProposalsRegistration = async(event) => {
    event.preventDefault();
    const { accounts, contract } = this.state;

    await contract.methods.startProposalsRegistration().send({from: accounts[0]});
  }

  handleEventVoterRegistered = async (event) => {
    const { whitelist } = this.state;
    const updatedWhitelist = whitelist;
    updatedWhitelist.push(event.returnValues[0]);
    this.setState({ whitelist: updatedWhitelist });
  }

  handleSubmitVoterRegistered = async(event) => {
    event.preventDefault();
    const { accounts, contract } = this.state;
    const address = this.state.formAddress;
    try {
      this.setState({ formError: null });
      await contract.methods.addToWhitelist(address).send({from: accounts[0]});
    } catch (error) {
      console.error(error.message);
      this.setState({ formError: error.message });
    }
  }

  render() {
    const { accounts, whitelist, proposals, winningProposalId, formError } = this.state;
    if (!this.state.web3) {
      return <div>Loading Web3, accounts, and contract...</div>;
    }
    return (
      <div className="App">
        <div>
            <h1 className="text-center">Voting System</h1>
            <hr></hr>
            <br></br>
        </div>

        {(() => {
          switch (this.state.workflow) {
            case 0:
              return (
                <div>
                  <h2>Registering Voters</h2>
                  <div style={{display: 'flex', justifyContent: 'center'}}>
                    <Card style={{ width: '50rem' }}>
                      <Card.Header><strong>Registered voters</strong></Card.Header>
                      <Card.Body>
                        <ListGroup variant="flush">
                          <ListGroup.Item>
                            <Table striped bordered hover>
                              <tbody>
                                { whitelist !== null && whitelist.map((a) => <tr><td>{a}</td></tr>) }
                              </tbody>
                            </Table>
                          </ListGroup.Item>
                        </ListGroup>
                      </Card.Body>
                    </Card>
                  </div>
                  <br></br>
                  <div style={{display: 'flex', justifyContent: 'center'}}>
                    <Card style={{ width: '50rem' }}>
                      <Card.Header><strong>Authorize new voters</strong></Card.Header>
                      <Card.Body>
                        <Form>
                          <Form.Group>
                            <Form.Control placeholder="Enter Address" isInvalid={Boolean(formError)} onChange={e => this.setState({ formAddress: e.target.value, formError: null })} type="text" />
                            <Form.Control.Feedback type="invalid">{formError}</Form.Control.Feedback>
                            <Form.Label style={{float: 'left'}}>Or</Form.Label>
                            <Form.Control defaultValue={'Default'} as="select" isInvalid={Boolean(formError)} onChange={e => this.setState({ formAddress: e.target.value, formError: null })}>
                              <option value="Default" disabled hidden>Select Address</option>
                              {/* get all connected accounts ? */}
                              { accounts !== null && accounts.map((a) => <option value={a}>{a}</option>) }
                            </Form.Control>
                            <br/>
                            <Button onClick={this.handleSubmitVoterRegistered}>Authorize</Button>
                          </Form.Group>
                        </Form>
                      </Card.Body>
                    </Card>
                    </div>
                  <br></br>
                  {(this.state.owner === accounts[0]) && <Button onClick={this.handleSubmitStartProposalsRegistration}>Start Proposals Registration</Button>}
                </div>
              )
            case 1:
              return (
                <div>
                  <h2>Proposals Registration Started</h2>
                  <div style={{display: 'flex', justifyContent: 'center'}}>
                    <Card style={{ width: '50rem' }}>
                      <Card.Header><strong>Proposals</strong></Card.Header>
                      <Card.Body>
                        <ListGroup variant="flush">
                          <ListGroup.Item>
                            <Table striped bordered hover>
                              <thead>
                                <tr>
                                  <th>index</th>
                                  <th>proposal</th>
                                </tr>
                              </thead>
                              <tbody>
                                { proposals !== null && proposals.map((key, index) =>
                                    <tr>
                                      <td>{index}</td>
                                      <td>{key.description}</td>
                                    </tr>
                                  )
                                }
                              </tbody>
                            </Table>
                          </ListGroup.Item>
                        </ListGroup>
                      </Card.Body>
                    </Card>
                  </div>
                  <br></br>
                  <div style={{display: 'flex', justifyContent: 'center'}}>
                    <Card style={{ width: '50rem' }}>
                      <Card.Header><strong>Add proposal</strong></Card.Header>
                      <Card.Body>
                        <Form.Group>
                          <Form.Control value={this.state.formProposal} onChange={e => this.setState({ formProposal: e.target.value })} type="text" />
                          <br/>
                          <Button onClick={this.handleSubmitRegisterProposal}>Send</Button>
                        </Form.Group>
                      </Card.Body>
                    </Card>
                  </div>
                  <br></br>
                  {(this.state.owner === accounts[0]) && <Button onClick={this.handleSubmitEndProposalsRegistration}>End Proposals Registration</Button>}
                </div>
              )
            case 2:
              return (
                <div>
                  <h2>Proposals Registration Ended</h2>
                  {(this.state.owner === accounts[0]) && <Button onClick={this.handleSubmitStartVotingSession}>Start Voting Session</Button>}
                </div>
              )
            case 3:
              return (
                <div>
                  <h2>Voting Session Started</h2>
                  <div style={{display: 'flex', justifyContent: 'center'}}>
                    <Card style={{ width: '50rem' }}>
                      <Card.Header><strong>Proposals</strong></Card.Header>
                      <Card.Body>
                        <ListGroup variant="flush">
                          <ListGroup.Item>
                            <Table striped bordered hover>
                              <thead>
                                <tr>
                                  <th>index</th>
                                  <th>proposal</th>
                                  <th>votes</th>
                                </tr>
                              </thead>
                              <tbody>
                                { proposals !== null && proposals.map((key, index) =>
                                    <tr>
                                      <td>{index}</td>
                                      <td>{key.description}</td>
                                      <td>{key.voteCount}</td>
                                    </tr>
                                  )
                                }
                              </tbody>
                            </Table>
                          </ListGroup.Item>
                        </ListGroup>
                      </Card.Body>
                    </Card>
                  </div>
                  <br></br>
                  <div style={{display: 'flex', justifyContent: 'center'}}>
                    <Card style={{ width: '50rem' }}>
                      <Card.Header><strong>Register Vote</strong></Card.Header>
                      <Card.Body>
                        <Form.Group>
                          <Form.Control defaultValue={'Default'} as="select" isInvalid={Boolean(formError)} onChange={e => this.setState({ formVote: e.target.value, formError: null })}>
                            <option value="Default" disabled hidden>Select Proposal</option>
                            { proposals !== null && proposals.map((key, index) => <option value={index}>{key.description}</option>) }
                          </Form.Control>
                          <Form.Control.Feedback type="invalid">{formError}</Form.Control.Feedback>
                          <br/>
                          <Button onClick={this.handleSubmitRegisterVote}>Send</Button>
                        </Form.Group>
                      </Card.Body>
                    </Card>
                  </div>
                  <br></br>
                  {(this.state.owner === accounts[0]) && <Button onClick={this.handleSubmitEndVotingSession}>End Voting Session</Button>}
                </div>
              )
            case 4:
              return (
                <div>
                  <h2>Tally Votes</h2>
                  <br></br>
                  {(this.state.owner === accounts[0]) && <Button onClick={this.handleSubmitTallyVotes}>See results</Button>}
                </div>
              )
            case 5:
              return (
                <div>
                  <h2>Votes Tallied</h2>
                  <div style={{display: 'flex', justifyContent: 'center'}}>
                    <Card style={{ width: '50rem' }}>
                      <Card.Header><strong>Winner</strong></Card.Header>
                      <Card.Body>
                        <h3>{proposals[winningProposalId].description}</h3>
                      </Card.Body>
                    </Card>
                  </div>
                  <br></br>
                  <div style={{display: 'flex', justifyContent: 'center'}}>
                    <Card style={{ width: '50rem' }}>
                      <Card.Header><strong>Results</strong></Card.Header>
                      <Card.Body>
                        <ListGroup variant="flush">
                          <ListGroup.Item>
                            <Table striped bordered hover>
                              <thead>
                                <tr>
                                  <th>index</th>
                                  <th>proposal</th>
                                  <th>votes</th>
                                </tr>
                              </thead>
                              <tbody>
                                { proposals !== null && proposals.map((key, index) =>
                                    <tr>
                                      <td>{index}</td>
                                      <td>{key.description}</td>
                                      <td>{key.voteCount}</td>
                                    </tr>
                                  )
                                }
                              </tbody>
                            </Table>
                          </ListGroup.Item>
                        </ListGroup>
                      </Card.Body>
                    </Card>
                  </div>
                </div>
              )
            default :
            return (
              <div>
                <h2>404: Nothing to do here</h2>
              </div>
            )
          }
        })()}
      </div>
    );
  }
}

export default App;
