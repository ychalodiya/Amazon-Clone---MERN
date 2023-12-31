import React, { useContext, useEffect, useReducer } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import LoadingBox from '../Components/LoadingBox';
import { Helmet } from 'react-helmet-async';
import MessageBox from '../Components/MessageBox';
import { Store } from '../Components/Store';
import axios from 'axios';
import { getError } from '../utils';
import { Card, Col, ListGroup, Row } from 'react-bootstrap';
import { PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { toast } from 'react-toastify';

const reducer = (state, action) => {
	switch (action.type) {
		case 'FETCH_REQUEST':
			return { ...state, loading: true };
		case 'FETCH_SUCCESS':
			return { ...state, loading: false, order: action.payload, error: '' };
		case 'FETCH_FAIL':
			return { ...state, loading: false, error: action.payload };
		case 'PAY_REQUEST':
			return { ...state, loadingPay: true };
		case 'PAY_SUCCESS':
			return { ...state, loadingPay: false, successPay: true };
		case 'PAY_FAIL':
			return { ...state, loadingPay: false, errorPay: action.payload };
		case 'PAY_RESET':
			return { ...state, loadingPay: false, successPay: false };
		default:
			return { ...state };
	}
};

export default function Order() {
	const params = useParams();
	const { id: orderId } = params;
	const navigate = useNavigate();
	const { state } = useContext(Store);
	const { userInfo } = state;
	const [{ loading, error, order, successPay, loadingPay }, dispatch] =
		useReducer(reducer, {
			loading: true,
			error: '',
			order: {},
			successPay: false,
			loadingPay: false,
		});

	const [{ isPending }, paypalDispatch] = usePayPalScriptReducer();

	const createOrder = (data, actions) => {
		return actions.order
			.create({
				purchase_units: [
					{
						amount: { value: order.totalPrice },
					},
				],
			})
			.then((orderId) => {
				return orderId;
			});
	};

	const onApprove = (data, actions) => {
		return actions.order.capture().then(async (details) => {
			try {
				dispatch({ type: 'PAY_REQUEST' });
				const { data } = await axios.put(
					`/api/orders/${order._id}/pay`,
					details,
					{
						headers: {
							authorization: `Bearer ${userInfo.token}`,
						},
					}
				);
				dispatch({ type: 'PAY_SUCCESS', payload: data });
				toast.success('Order is paid');
			} catch (err) {
				dispatch({ type: 'PAY_FAIL', payload: getError(err) });
				toast.error(getError(err));
			}
		});
	};

	const onError = (err) => {
		toast.error(getError(err));
	};

	const fetchOrder = async () => {
		try {
			dispatch({ type: 'FETCH_REQUEST' });
			const { data } = await axios(`/api/orders/${orderId}`, {
				headers: {
					authorization: `Bearer ${userInfo.token}`,
				},
			});

			dispatch({ type: 'FETCH_SUCCESS', payload: data });
		} catch (err) {
			dispatch({ type: 'FETCH_FAIL', payload: getError(err) });
		}
	};

	useEffect(() => {
		if (!userInfo) {
			navigate('/login');
		}
		if (!order._id || successPay || (order._id && order._id !== orderId)) {
			fetchOrder();
			if (successPay) {
				dispatch({ type: 'PAY_RESET' });
			}
		} else {
			const loadPayPalScript = async () => {
				const { data: clientID } = await axios.get('/api/keys/paypal', {
					headers: {
						authorization: `Bearer ${userInfo.token}`,
					},
				});
				paypalDispatch({
					type: 'resetOptions',
					value: {
						'client-id': clientID,
						currency: 'USD',
					},
				});
				paypalDispatch({
					type: 'setLoadingStatus',
					value: 'pending',
				});
			};

			loadPayPalScript();
		}
	}, [order, userInfo, orderId, navigate, paypalDispatch, successPay]);

	return loading ? (
		<LoadingBox />
	) : error ? (
		<>
			<Helmet>
				<title> {error} </title>
			</Helmet>
			<MessageBox variant="danger">{error}</MessageBox>
		</>
	) : (
		<div>
			<Helmet>
				<title>Order {orderId}</title>
			</Helmet>
			<h1 className="my-3">Order {orderId}</h1>
			<Row>
				<Col md={8}>
					<Card className="mb-3">
						<Card.Body>
							<Card.Title>Shipping</Card.Title>
							<Card.Text>
								<strong>Name: </strong> {order.shippingAddress.fullName} <br />
								<strong>Address: </strong> {order.shippingAddress.address},{' '}
								{order.shippingAddress.city}, {order.shippingAddress.postalCode}
								, {order.shippingAddress.country}
							</Card.Text>
							{order.isDelivered ? (
								<MessageBox variant="success">
									Order delivered at {order.deliveredAt}
								</MessageBox>
							) : (
								<MessageBox variant="danger">Not Delivered</MessageBox>
							)}
						</Card.Body>
					</Card>

					<Card className="mb-3">
						<Card.Body>
							<Card.Title>Payment</Card.Title>
							<Card.Text>
								<strong>Method: </strong> {order.paymentMethod}
							</Card.Text>
							{order.isPaid ? (
								<MessageBox variant="success">
									Paid at {order.paidAt}
								</MessageBox>
							) : (
								<MessageBox variant="danger">Not Paid</MessageBox>
							)}
						</Card.Body>
					</Card>

					<Card className="mb-3">
						<Card.Body>
							<Card.Title>Items</Card.Title>
							<ListGroup variant="flush">
								{order.orderItems.map((item) => (
									<ListGroup.Item key={item._id}>
										<Row className="align-items-center">
											<Col md={6}>
												<img
													src={item.image}
													alt={item.name}
													className="img-fluid rounded img-thumbnail"
												/>{' '}
												<Link to={`/product/${item.slug}`}>{item.name}</Link>
											</Col>
											<Col md={3}>
												<span>{item.quantity}</span>
											</Col>
											<Col md={3}>
												<span>$ {item.price}</span>
											</Col>
										</Row>
									</ListGroup.Item>
								))}
							</ListGroup>
						</Card.Body>
					</Card>
				</Col>
				<Col md={4}>
					<Card>
						<Card.Body>
							<Card.Title>Order Summary</Card.Title>
							<ListGroup variant="flush">
								<ListGroup.Item>
									<Row>
										<Col>Items</Col>
										<Col>
											{': '}${order.itemPrice.toFixed(2)}
										</Col>
									</Row>
								</ListGroup.Item>
								<ListGroup.Item>
									<Row>
										<Col>Shipping</Col>
										<Col>
											{': '}${order.shippingPrice.toFixed(2)}
										</Col>
									</Row>
								</ListGroup.Item>
								<ListGroup.Item>
									<Row>
										<Col>Tax (13%)</Col>
										<Col>
											{': '}${order.taxPrice.toFixed(2)}
										</Col>
									</Row>
								</ListGroup.Item>
								<ListGroup.Item>
									<Row>
										<Col>Order Total</Col>
										<Col>
											{': '}${order.totalPrice.toFixed(2)}
										</Col>
									</Row>
								</ListGroup.Item>
								{!order.isPaid && (
									<ListGroup.Item>
										{isPending ? (
											<LoadingBox />
										) : (
											<div>
												<PayPalButtons
													createOrder={createOrder}
													onApprove={onApprove}
													onError={onError}
												></PayPalButtons>
											</div>
										)}
										{loadingPay && <LoadingBox />}
									</ListGroup.Item>
								)}
							</ListGroup>
						</Card.Body>
					</Card>
				</Col>
			</Row>
		</div>
	);
}
